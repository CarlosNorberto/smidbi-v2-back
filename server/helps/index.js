const fs = require('fs');
const md = require('../models');
const { differenceInCalendarDays, format, parseISO } = require('date-fns');
const { formatInTimeZone } = require('date-fns-tz');

const TIMEZONE = 'America/La_Paz';

const getUploadUrl = (req, folder, filename) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/uploads/${folder}/${filename}`;
};

const getUploadPath = (folder, filename) => {
    return `uploads/${folder}/${filename}`;
};

const convertImageToBase64 = async (imagePath) => {
    const base64 = fs.readFileSync(imagePath, { encoding: 'base64' });
    return `data:image/png;base64,${base64}`;
};

const getObjetivoLogrado = async (idReporte, idObjetivo) => {
    const objetivoLogrado =
        (await md.reporte_dia.sum('valor', {
            where: {
                id_reporte: idReporte,
                id_objetivo: idObjetivo,
            },
        })) ?? 0;
    return objetivoLogrado;
};

/**
 * Calcula el progreso de presupuesto de un objetivo.
 *
 * @param {Object} params
 * @param {number} params.objetivoLogrado - valor logrado del objetivo
 * @param {Object} params.reporte - debe traer: id, cp, id_objetivo, fecha_ini, fecha_fin
 * @returns {Promise<number>} resultado con 2 decimales
 */
const getProgresoPresupuesto = async (objetivoLogrado, reporte) => {
    let resultado;

    const cp = reporte.cp;
    const idObjetivo = reporte.id_objetivo;
    const presupuesto = reporte.presupuesto;

    if (cp > 0) {
        // Si el objetivo es distinto de 3 (impresiones), se calcula el progreso como objetivo_logrado * cp.
        // Si el objetivo es 3 (impresiones), se calcula como (objetivo_logrado / 1000) * cp.
        if (idObjetivo !== 3) {
            resultado = objetivoLogrado * cp;
        } else {
            resultado = (objetivoLogrado / 1000) * cp;
        }
    } else {
        const percent = await percentDias(reporte);
        resultado = (Math.trunc(percent) * presupuesto) / 100;
    }

    const montoEjecutado = Math.round(resultado * 100) / 100;

    // Calcula el porcentaje del presupuesto ejecutado
    const porcentaje =
        presupuesto > 0
            ? Math.min(100, Math.round((montoEjecutado / presupuesto) * 100))
            : 0;

    return {
        monto: montoEjecutado,
        porcentaje,
    };
};

const getExpirationStatus = (card) => {
    // 'expired' | 'active' | 'expiring_soon'
    if (card.exp_date_year && card.exp_date_month && card.exp_date_day) {
        const expDate = new Date(
            card.exp_date_year,
            card.exp_date_month - 1,
            card.exp_date_day,
            card.exp_time_hour,
            card.exp_time_minute,
        );
        const currentDate = new Date();
        const timeDiff = expDate - currentDate;
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        if (timeDiff < 0) {
            return 'expired';
        } else if (daysDiff <= 1) {
            return 'expiring_soon';
        } else {
            return 'active';
        }
    }
    return '';
};

/**
 * Genera el código de contrato
 * @param {Date} applicationDate - Fecha de aplicación
 * @param {number} contractId - ID del contrato
 * @returns {string} Código de contrato
 */
const generateContractCode = (applicationDate, contractId) => {
    const applicationYear = applicationDate
        ? applicationDate.split('-')[0]
        : null;

    return `ADM-CTR-${applicationYear}-${contractId}`;
};

/**
 * Convierte una cadena de fecha a un objeto Date
 * @param {string} dateString - Cadena de fecha
 * @returns {Date} Fecha
 */
const parseToDate = (dateString) => {
    if (!dateString) return null;

    // ambos formatos los maneja parseISO
    // '2026-06-24' → '2026-06-24'
    // '2026-02-01T04:00:00.000Z' → '2026-02-01'
    return format(parseISO(dateString), 'yyyy-MM-dd');
};

/**
 * Devuelve la fecha actual (solo fecha, sin hora) en timezone de Bolivia
 * @returns {string} Fecha en formato 'yyyy-MM-dd'
 */
const getFechaActualLaPaz = () => {
    return formatInTimeZone(new Date(), TIMEZONE, 'yyyy-MM-dd');
};

/**
 * Calcula el porcentaje de dias activos de un reporte respecto a su campaña.
 * Traduccion de la funcion percent_dias(idreporte, idobj) de postgres.
 * @param {Object} reporte - debe traer: id, fecha_ini, fecha_fin, id_objetivo
 * @returns {Promise<number>} porcentaje (0-100)
 */
const percentDias = async (reporte, id_objetivo) => {
    const { id: idreporte, fecha_ini, fecha_fin } = reporte;
    const idobj = id_objetivo;

    // normalizamos por si acaso llega timestamp completo en vez de date-only
    const fechaIni = parseToDate(fecha_ini);
    const fechaFin = parseToDate(fecha_fin);
    const fechaActual = getFechaActualLaPaz();

    if (fechaIni <= fechaFin && fechaActual <= fechaFin) {
        const dIni = parseISO(fechaIni);
        const dFin = parseISO(fechaFin);
        const dActual = parseISO(fechaActual);

        const difDiasCampana = differenceInCalendarDays(dFin, dIni) + 1;
        let difDiasActual = differenceInCalendarDays(dActual, dIni) + 1;
        if (difDiasActual < 0) difDiasActual = 0;

        // Dias inactivos entre fecha_ini de campaña y fecha_actual
        const [{ inactivo }] = await md.sequelize.query(
            `SELECT COUNT(*)::int AS inactivo
       FROM reporte_dia
       WHERE id_reporte = :idreporte
         AND id_objetivo = :idobj
         AND valor = 0
         AND TO_DATE(CONCAT(anio, '/', mes, '/', dia), 'yyyy/mm/dd') <= :fechaActual`,
            {
                replacements: { idreporte, idobj, fechaActual },
                type: md.sequelize.QueryTypes.SELECT,
            },
        );

        let activo = difDiasActual - inactivo;
        if (activo < 0) activo = 0;

        const diasActivosYRestantes = difDiasCampana - inactivo;
        const resultado =
            diasActivosYRestantes > 0
                ? (activo / diasActivosYRestantes) * 100
                : 0;

        return Math.round(resultado * 100) / 100;
    }

    return 100;
};

module.exports = {
    getUploadUrl,
    getUploadPath,
    convertImageToBase64,
    getObjetivoLogrado,
    getProgresoPresupuesto,
    getExpirationStatus,
    generateContractCode,
    parseToDate,
    getFechaActualLaPaz,
    percentDias,
};
