const md = require('../../models');
const { findLatest, checkCanInvalidate, deleteProposals, removeFiles } = require('./proposal_service');

// Calcula el objetivo (alcance/clics/views para CPC_CPV, impresiones para CPM)
// a partir de la inversión y el costo unitario. Se recalcula siempre en el
// servidor (no se confía en lo que mande el cliente).
const calcularObjetivo = (tipo, inversion, costo) => {
    const inv = Number(inversion) || 0;
    const cost = Number(costo) || 0;
    if (!cost) return 0;
    if (tipo === 'CPM') {
        return Math.round((inv / cost) * 1000);
    }
    return Math.round(inv / cost);
};

// Suma de todos los "valor" de summary_meses (debe dar 100, son % de la
// inversión de esa línea distribuidos por semana).
const sumaSummaryMeses = (summaryMeses) => {
    if (!Array.isArray(summaryMeses)) return 0;
    return summaryMeses.reduce((total, mes) => {
        const semanas = Array.isArray(mes.semanas) ? mes.semanas : [];
        return total + semanas.reduce((acc, semana) => acc + (Number(semana.valor) || 0), 0);
    }, 0);
};

// Distribución por defecto cuando el usuario todavía no armó una manual: 100%
// en la primera semana del mes actual, para que la línea nunca quede en un
// estado de distribución inconsistente/vacío.
const defaultSummaryMeses = () => ([
    {
        mes: new Date().getMonth() + 1,
        semanas: [{ valor: 100 }, { valor: 0 }, { valor: 0 }, { valor: 0 }],
    },
]);

// Forma canónica de una línea (+ su distribución semanal) para saber si la cotización
// realmente cambió respecto a lo ya guardado. Se compara por id_costo, sin importar el
// orden, y los números se normalizan (la base devuelve los decimales como texto).
const canonicalSummary = (summaryMeses) => (Array.isArray(summaryMeses) ? summaryMeses : []).map((m) => ({
    mes: Number(m.mes),
    semanas: (Array.isArray(m.semanas) ? m.semanas : []).map((s) => Number(s.valor) || 0),
}));

const canonicalLinea = (linea, summaryMeses) => ({
    id_plataforma: Number(linea.id_plataforma),
    nombre: String(linea.nombre),
    id_costo: Number(linea.id_costo),
    costo: Number(linea.costo),
    inversion: Number(linea.inversion) || 0,
    kpi_principal: Number(linea.kpi_principal) || 0,
    kpi_secundario: Number(linea.kpi_secundario) || 0,
    frecuencia: Number(linea.frecuencia) || 0,
    summary: canonicalSummary(summaryMeses),
});

const canonicalList = (items) => JSON.stringify(items.sort((a, b) => a.id_costo - b.id_costo));

const cotizacionCambio = async ({ id_brief, grupo, tipo, lineas }) => {
    const [existentes, summaries] = await Promise.all([
        md.performance_branding.findAll({ where: { id_brief, grupo, tipo } }),
        md.summary.findAll({ where: { id_brief, grupo, tipo } }),
    ]);
    const summaryByCosto = new Map(summaries.map((s) => [s.id_costo, s.summary_meses]));

    const actuales = existentes.map((e) => canonicalLinea(e, summaryByCosto.get(e.id_costo)));
    // Si el front no manda la distribución de una línea, se considera sin cambios en ese
    // aspecto (el servidor le pondría la distribución por defecto solo si es una línea nueva).
    const nuevas = lineas.map((l) => canonicalLinea(l, l.summary_meses ?? summaryByCosto.get(Number(l.id_costo))));
    return canonicalList(actuales) !== canonicalList(nuevas);
};

const getByBrief = async (req, res) => {
    try {
        const { id_brief, grupo } = req.params;

        const [costos, lineas, summaries, propuestaRow] = await Promise.all([
            // Catálogo seleccionable: solo costos de plataformas activas. Una
            // plataforma nunca se borra (solo se desactiva, ver migración de la FK),
            // así que esto simplemente oculta las que el admin desactivó — las líneas
            // ya guardadas de una plataforma desactivada NO se pierden (ver abajo).
            md.costo_por.findAll({
                where: { grupo, activo: true },
                include: [{ model: md.plataformas, as: 'plataforma', attributes: ['id', 'plataforma', 'icono'], where: { activo: true }, required: true }],
                order: [['tipo', 'ASC'], ['nombre', 'ASC']],
            }),
            md.performance_branding.findAll({
                where: { id_brief, grupo },
                include: [{ model: md.plataformas, as: 'plataforma', attributes: ['id', 'plataforma'], required: false }],
                order: [['id_plataforma', 'ASC']],
            }),
            md.summary.findAll({ where: { id_brief, grupo } }),
            findLatest(id_brief),
        ]);

        const summaryByTipoAndCosto = new Map();
        summaries.forEach((s) => {
            summaryByTipoAndCosto.set(`${s.tipo}_${s.id_costo}`, s.summary_meses);
        });

        const lineasConSummary = lineas.map((linea) => ({
            ...linea.toJSON(),
            summary_meses: summaryByTipoAndCosto.get(`${linea.tipo}_${linea.id_costo}`) || null,
        }));

        // Estado de la propuesta (PDF) vigente del brief: null si todavía no se generó (o si
        // se modificó la cotización desde la última vez). `token` solo lo ve el personal.
        const propuesta = propuestaRow
            ? {
                token: propuestaRow.token,
                tipos: propuestaRow.tipos,
                activo: propuestaRow.activo,
                respuesta: propuestaRow.respuesta,
                fecha_creacion: propuestaRow.fecha_creacion,
            }
            : null;

        res.status(200).json({ costos, lineas: lineasConSummary, propuesta });
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la cotización: ${error.message}` });
    }
};

const saveBulk = async (req, res) => {
    const { id_brief, grupo, tipo, lineas } = req.body;

    if (!id_brief || !grupo || !tipo) {
        return res.status(400).json({ message: 'id_brief, grupo y tipo son obligatorios.' });
    }
    if (!Array.isArray(lineas)) {
        return res.status(400).json({ message: 'lineas debe ser un arreglo.' });
    }
    for (const linea of lineas) {
        if (!linea.id_plataforma || !linea.id_costo || !linea.nombre) {
            return res.status(400).json({ message: 'Cada línea requiere id_plataforma, id_costo y nombre.' });
        }
        // El PDF del Planificador (Resumen Ejecutivo, Mecánica de Inversión)
        // necesita el KPI principal y secundario de cada línea para no mostrar
        // "KPI sin definir" — se exige acá, no solo en el frontend, porque el
        // endpoint también se puede llamar directo (curl, otro cliente).
        if (!linea.kpi_principal || !linea.kpi_secundario) {
            return res.status(400).json({
                message: `La línea "${linea.nombre}" necesita un KPI principal y un KPI secundario antes de guardar.`,
            });
        }
        const summaryMeses = linea.summary_meses;
        if (summaryMeses && Math.round(sumaSummaryMeses(summaryMeses)) !== 100) {
            return res.status(400).json({
                message: `La distribución de "${linea.nombre}" debe sumar 100% (suma actual: ${sumaSummaryMeses(summaryMeses)}%).`,
            });
        }
    }

    // Si la cotización no cambió, no se toca nada: ni las filas ni el PDF/link vigentes.
    try {
        if (!(await cotizacionCambio({ id_brief, grupo, tipo, lineas }))) {
            return res.status(200).json({ message: 'Sin cambios en la cotización', changed: false, proposal_invalidated: false });
        }

        // Hay cambios: si el cliente ya aceptó la propuesta, solo un admin/superadmin con
        // confirmación explícita puede continuar (se pierde el registro de lo aceptado).
        const blocked = await checkCanInvalidate({
            id_brief,
            user: req.user,
            confirmEditAccepted: req.body.confirm_edit_accepted === true,
        });
        if (blocked) return res.status(blocked.status).json(blocked.body);
    } catch (error) {
        return res.status(500).json({ message: `Error al guardar la cotización: ${error.message}` });
    }

    const t = await md.sequelize.transaction();
    let oldFiles = [];
    try {
        await md.performance_branding.destroy({ where: { id_brief, grupo, tipo }, transaction: t });
        await md.summary.destroy({ where: { id_brief, grupo, tipo }, transaction: t });

        const now = new Date();
        const performanceBrandingRows = lineas.map((linea) => ({
            id_brief,
            grupo,
            tipo,
            id_plataforma: linea.id_plataforma,
            nombre: linea.nombre,
            id_costo: linea.id_costo,
            costo: linea.costo,
            inversion: linea.inversion || 0,
            objetivo: calcularObjetivo(tipo, linea.inversion, linea.costo),
            kpi_principal: linea.kpi_principal || 0,
            kpi_secundario: linea.kpi_secundario || 0,
            frecuencia: linea.frecuencia || 0,
            activo: true,
            usuario_creacion: req.user.id,
            fecha_creacion: now,
        }));

        const created = await md.performance_branding.bulkCreate(performanceBrandingRows, { transaction: t });

        const summaryRows = lineas.map((linea) => ({
            id_brief,
            grupo,
            tipo,
            id_costo: linea.id_costo,
            summary_meses: linea.summary_meses || defaultSummaryMeses(),
            usuario_creacion: req.user.id,
            fecha_creacion: now,
        }));

        if (summaryRows.length > 0) {
            await md.summary.bulkCreate(summaryRows, { transaction: t });
        }

        // Cualquier cambio en la cotización invalida el PDF ya generado (si existe): se
        // borra su fila y su archivo, y el link que se envió al cliente deja de funcionar.
        // El siguiente "Generar PDF" crea uno nuevo.
        oldFiles = await deleteProposals(id_brief, t);

        await t.commit();
        removeFiles(oldFiles);
        res.status(200).json({
            message: 'Cotización guardada correctamente',
            changed: true,
            proposal_invalidated: oldFiles.length > 0,
            data: created,
        });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: `Error al guardar la cotización: ${error.message}` });
    }
};

module.exports = {
    getByBrief,
    saveBulk,
};
