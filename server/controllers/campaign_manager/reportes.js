const md = require('../../models');
const { Op } = require('sequelize');
const { DateTime } = require('luxon');
const { isBefore, addDays, parseISO, format } = require('date-fns');
const {
    getUploadUrl,
    getUploadPath,
    getObjetivoLogrado,
    percentDias,
    getProgresoPresupuesto,
    getFechaActualLaPaz,
    parseToDate,
} = require('../../helps');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const { canManageReport, canManageCampaign, getCampaignOwnerId, denyAccess } = require('../../auth/ownership');
const { notifyReportCreated } = require('../../services/reportCreatedNotification');

// ************** REPORTS

// Columnas que puede leer quien entra SOLO con el token del aviso de WhatsApp (sin sesión): las que pide la
// pantalla del reporte en solo lectura. Con sesión se puede pedir cualquier columna, como siempre.
const GUEST_REPORT_ATTRIBUTES = [
    'id', 'nombre', 'fecha_ini', 'fecha_fin', 'presupuesto', 'objetivo_proyectado',
    'id_plataforma', 'id_objetivo', 'cp', 'ctr', 'activo', 'frecuencia',
];

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        let { attributes } = req.query;
        attributes = attributes ? attributes.split(',') : null;
        if (req.reportAccess && attributes) {
            attributes = attributes.filter((a) => GUEST_REPORT_ATTRIBUTES.includes(a));
            if (attributes.length === 0) attributes = null;
        }
        const reporte = await md.reportes.findOne({
            where: {
                id: id,
            },
            attributes: attributes
                ? attributes
                : ['id', 'nombre'], // (antes pedía 'descripcion', que reportes no tiene: sin ?attributes daba error 500)
        });
        if (!reporte) {
            return res.status(404).json({ message: 'Reporte no encontrado' });
        }
        res.status(200).json(reporte);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener el reporte: ${error.message}`,
        });
    }
};

const getAllByCampaign = async (req, res) => {
    try {
        const { campaign_id } = req.params;
        const { page = 1, limit = 10, name = null, year = null, month = null } = req.query;
        const offset = (page - 1) * limit;
        let where = {
            id_campana: campaign_id,
        };
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`,
            };
        }
        // Filtro opcional por mes/año de inicio del reporte (fecha_ini).
        if (year && month) {
            const y = Number.parseInt(year, 10);
            const m = Number.parseInt(month, 10);
            if (!Number.isInteger(y) || !Number.isInteger(m) || y < 2000 || y > 2100 || m < 1 || m > 12) {
                return res.status(400).json({ message: 'El año y el mes no son válidos.' });
            }
            const lastDay = new Date(y, m, 0).getDate();
            const mm = String(m).padStart(2, '0');
            where.fecha_ini = {
                [md.Sequelize.Op.between]: [`${y}-${mm}-01`, `${y}-${mm}-${String(lastDay).padStart(2, '0')}`],
            };
        }
        const reportes = await md.reportes
            .scope(['withCampaign', 'withPlatform'])
            .findAndCountAll({
                where: where,
                attributes: {
                    exclude: [
                        'usuario_creacion',
                        'usuario_modificacion',
                        'usuario_eliminacion',
                        'fecha_modificacion',
                        'fecha_eliminacion',
                    ],
                },
                order: [['fecha_creacion', 'DESC']],
                limit,
                offset,
            });
        res.status(200).json(reportes);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener los reportes ${error.message}`,
        });
    }
};

const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.params;
        const offset = (page - 1) * limit;
        let where = {};
        if (req.body) {
            const {
                name,
                own,
                campaign_id,
                category_id,
                company_id,
                year,
                month,
            } = req.body;
            if (own === true || own === 'true') {
                where.id_usuario = req.user.id;
            }
            if (name) {
                where.nombre = {
                    [md.Sequelize.Op.iLike]: `%${name}%`,
                };
            }
            if (campaign_id) {
                where.id_campana = campaign_id;
            }
            if (category_id) {
                where['$campana.id_categoria$'] = category_id;
            }
            if (company_id) {
                where['$campana.categoria.id_empresa$'] = company_id;
            }
            if (year && month) {
                where.fecha_ini = {
                    [md.Sequelize.Op.and]: [
                        md.Sequelize.where(
                            md.Sequelize.fn(
                                'EXTRACT',
                                md.Sequelize.literal('YEAR FROM "fecha_ini"'),
                            ),
                            year,
                        ),
                        md.Sequelize.where(
                            md.Sequelize.fn(
                                'EXTRACT',
                                md.Sequelize.literal('MONTH FROM "fecha_ini"'),
                            ),
                            month,
                        ),
                    ],
                };
            }
        }
        const reportes = await md.reportes.findAndCountAll({
            where: where,
            include: [
                {
                    model: md.campanas,
                    as: 'campana',
                    attributes: ['id', 'nombre', 'id_categoria'],
                    required: true,
                    include: [
                        {
                            model: md.categorias,
                            as: 'categoria',
                            attributes: ['id', 'nombre', 'id_empresa'],
                            required: true,
                            include: [
                                {
                                    model: md.empresas,
                                    as: 'empresa',
                                    attributes: ['id', 'nombre'],
                                    required: true,
                                },
                            ],
                        },
                    ],
                },
            ],
            limit,
            offset,
        });
        res.status(200).json(reportes);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener los reportes ${error.message}`,
        });
    }
};

// Campos que el cliente nunca puede fijar por el body. En particular
// `id_usuario` (responsable del reporte) se asigna al crearlo y NO cambia al
// editar: antes cada guardado lo pisaba con el usuario que editaba y el reporte
// "cambiaba de dueño". `id_campana` tampoco se mueve al editar.
const REPORT_PROTECTED_FIELDS = [
    'id_usuario',
    'usuario_creacion',
    'usuario_modificacion',
    'usuario_eliminacion',
    'fecha_creacion',
    'fecha_modificacion',
    'fecha_eliminacion',
];

// Un reporte no se puede reactivar mientras su campaña esté inactiva (el cliente
// seguiría sin acceso y el estado quedaría inconsistente).
const INACTIVE_CAMPAIGN_ERROR = {
    message: 'No se puede reactivar el reporte porque su campaña está inactiva. Reactive primero la campaña.',
};
const isCampaignActive = async (campaignId, transaction = null) => {
    const campana = await md.campanas.findByPk(campaignId, { attributes: ['activo'], transaction });
    return !campana || campana.activo !== false;
};

const saveUpdate = async (req, res) => {
    const transaction = await md.sequelize.transaction();
    try {
        const body = { ...req.body };
        REPORT_PROTECTED_FIELDS.forEach((field) => delete body[field]);
        const isNewReport = !body.id;
        let report = null;
        let previousFechaIni = null;
        let previousFechaFin = null;
        let previousObjetivo = null;

        if (!isNewReport) {
            report = await md.reportes.findByPk(body.id, { transaction });
            if (!report) {
                await transaction.rollback();
                return res.status(404).json({
                    message: 'No se encontró el reporte para actualizar',
                });
            }
            if (!(await canManageReport(req.user, report.id))) {
                await transaction.rollback();
                return denyAccess(res);
            }
            delete body.id_campana;
            if (body.activo === true && report.activo === false && !(await isCampaignActive(report.id_campana, transaction))) {
                await transaction.rollback();
                return res.status(409).json(INACTIVE_CAMPAIGN_ERROR);
            }
            previousFechaIni = report.fecha_ini;
            previousFechaFin = report.fecha_fin;
            previousObjetivo = report.id_objetivo;
        } else if (!(await canManageCampaign(req.user, body.id_campana))) {
            await transaction.rollback();
            return denyAccess(res);
        }

        // fecha_ini/fecha_fin viajan como 'YYYY-MM-DD' (fecha calendario, sin
        // hora). Se espejan a los campos legacy fecha_inicio/fecha_final
        // (timestamp) porque no existe ningún trigger en BD que lo haga, y
        // reporte_dias solo se regenera si el rango realmente cambió (o es un
        // reporte nuevo), para no reiniciar a cero los valores cargados en
        // guardados que no tocan fechas.
        const datesChanged =
            isNewReport ||
            (!!body.fecha_ini && body.fecha_ini !== previousFechaIni) ||
            (!!body.fecha_fin && body.fecha_fin !== previousFechaFin);
        const finalFechaIni = body.fecha_ini || previousFechaIni;
        const finalFechaFin = body.fecha_fin || previousFechaFin;

        if (body.fecha_ini) {
            body.fecha_inicio = parseISO(body.fecha_ini);
        }
        if (body.fecha_fin) {
            body.fecha_final = parseISO(body.fecha_fin);
        }

        if (isNewReport) {
            // El responsable es el de la empresa (no quien lo crea) y queda fijo.
            body.usuario_creacion = req.user.id;
            body.id_usuario = (await getCampaignOwnerId(body.id_campana)) ?? req.user.id;
            report = await md.reportes.create(body, { transaction });
        } else {
            body.usuario_modificacion = req.user.id;
            body.fecha_modificacion = new Date();
            await report.update(body, { transaction });
        }

        // Los días son por (reporte, objetivo). Si cambió el rango, se
        // regeneran para el objetivo actual. Si solo cambió el objetivo
        // principal, se crean únicamente si ese objetivo aún no tiene días
        // (para no borrar valores que ya existan, p. ej. de un objetivo que
        // antes era secundario).
        const objectiveChanged =
            !isNewReport &&
            body.id_objetivo !== undefined &&
            body.id_objetivo !== null &&
            Number(body.id_objetivo) !== Number(previousObjetivo);

        if (finalFechaIni && finalFechaFin && (datesChanged || objectiveChanged)) {
            await createDaysForReport(
                report.id,
                report.id_objetivo,
                finalFechaIni,
                finalFechaFin,
                req.user.id,
                transaction,
                !datesChanged,
            );
        }

        await transaction.commit();

        // Aviso por WhatsApp de "Nuevo reporte creado" (solo al crear, ya con todo guardado). Sin await a
        // propósito: no demora la respuesta y nunca falla hacia quien crea el reporte; si nadie está
        // suscrito al proceso no hace nada (ver services/reportCreatedNotification.js).
        if (isNewReport) notifyReportCreated(report.id);

        res.status(200).json({
            message: 'Reporte guardado correctamente',
            data: report,
        });
    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        res.status(500).json({
            message: `Error al guardar el reporte ${error.message}`,
        });
    }
};

// Genera los días del rango para (reporte, objetivo). Los errores se propagan
// a propósito: antes se registraban y se tragaban, y el reporte se guardaba
// "con éxito" pero con los días borrados o sin crear. Quien llama decide si
// revertir (ambos llamadores trabajan dentro de una transacción).
// `onlyIfMissing`: no hace nada si el objetivo ya tiene días cargados.
const createDaysForReport = async (
    reportId,
    objetivoId,
    dateInit,
    dateEnd,
    user_id,
    transaction = null,
    onlyIfMissing = false,
) => {
    if (onlyIfMissing) {
        const existing = await md.reporte_dia.count({
            where: { id_reporte: reportId, id_objetivo: objetivoId },
            transaction,
        });
        if (existing > 0) return;
    }

    // dateInit/dateEnd llegan como 'YYYY-MM-DD' (fecha calendario) o ya
    // como Date. parseISO trata un string solo-fecha como medianoche
    // LOCAL (no UTC), por lo que el día no se desplaza sin importar la
    // timezone del proceso de Node.
    let current =
        typeof dateInit === 'string' ? parseISO(dateInit) : dateInit;
    const end = typeof dateEnd === 'string' ? parseISO(dateEnd) : dateEnd;

    await md.reporte_dia.destroy({
        where: {
            id_reporte: reportId,
            id_objetivo: objetivoId,
        },
        transaction,
    });

    const days = [];
    while (isBefore(current, addDays(end, 1))) {
        days.push({
            id_reporte: reportId,
            id_objetivo: objetivoId,
            dia: current.getDate(),
            mes: current.getMonth() + 1,
            anio: current.getFullYear(),
            valor: 0,
            usuario_creacion: user_id,
        });
        current = addDays(current, 1);
    }
    if (days.length > 0) {
        await md.reporte_dia.bulkCreate(days, { transaction });
    }
};

// *********************************************//
// **** COPIAR REPORTE (y su configuración)  ****//
// *********************************************//

// Campos que nunca se arrastran a una copia: son metadatos de la fila
// original o números de seguimiento real (no tiene sentido que una copia
// "recién creada" ya tenga ejecución/resultados de otro reporte).
const REPORT_COPY_RESET_FIELDS = {
    activo: true,
    fecha_inicio: null,
    fecha_final: null,
    fecha_ini: null,
    fecha_fin: null,
    ejecutado: 0,
    ejecutado_seg: null,
    diferencia_seg: null,
    seguimiento_finalizado: false,
    estado_pauta: false,
    pagado: false,
    has_excel_ads: false,
};

const buildReportCopyData = (sourceReport, overrides, userId) => {
    const data = sourceReport.toJSON ? sourceReport.toJSON() : { ...sourceReport };
    delete data.id;
    delete data.fecha_creacion;
    delete data.fecha_modificacion;
    delete data.fecha_eliminacion;
    delete data.usuario_modificacion;
    delete data.usuario_eliminacion;
    return {
        ...data,
        ...REPORT_COPY_RESET_FIELDS,
        usuario_creacion: userId,
        // El responsable lo fija copyReportWithChildren (dueño de la empresa); `userId` es solo quien copia.
        ...overrides,
    };
};

// Tablas hijas del reporte con una sola fila (o ninguna) por reporte.
const CHILD_TABLES_SINGLE = [
    'interaccion_dispositivo',
    'interaccion_edad',
    'interaccion_hora',
    'segmentacion',
    'mapa_bolivia',
];
// Tablas hijas del reporte con varias filas posibles por reporte.
const CHILD_TABLES_MULTI = [
    'interaccion_genero',
    'reporte_objetivos_secundarios',
    'funnel_stage',
    'view_ads',
];

// Copia toda la configuración de un reporte (género, dispositivos, edades,
// horas, segmentación, mapa, objetivos secundarios, funnel, anuncios) hacia
// otro reporte. No copia reporte_dia: son los valores reales día a día, no
// tiene sentido arrastrarlos a una copia.
const copyReportChildren = async (sourceReportId, newReportId, userId, transaction) => {
    for (const model of CHILD_TABLES_SINGLE) {
        const row = await md[model].findOne({ where: { id_reporte: sourceReportId }, transaction });
        if (!row) continue;
        const data = row.toJSON();
        delete data.id;
        data.id_reporte = newReportId;
        if ('usuario_creacion' in data) data.usuario_creacion = userId;
        if ('usuario_modificacion' in data) data.usuario_modificacion = null;
        if ('fecha_modificacion' in data) data.fecha_modificacion = null;
        await md[model].create(data, { transaction });
    }
    for (const model of CHILD_TABLES_MULTI) {
        const rows = await md[model].findAll({ where: { id_reporte: sourceReportId }, transaction });
        for (const row of rows) {
            const data = row.toJSON();
            delete data.id;
            data.id_reporte = newReportId;
            if ('usuario_creacion' in data) data.usuario_creacion = userId;
            if ('usuario_modificacion' in data) data.usuario_modificacion = null;
            if ('fecha_modificacion' in data) data.fecha_modificacion = null;
            await md[model].create(data, { transaction });
        }
    }
};

// Crea la copia de un reporte (fila + configuración) dentro de una
// transacción. `overrides` define lo que cambia respecto al original
// (nombre, campaña destino, fechas, etc.).
const copyReportWithChildren = async (sourceReport, overrides, userId, transaction) => {
    // El responsable de la copia es el dueño de la empresa, NUNCA quien copia. Quien llama puede pasarlo ya
    // resuelto (`overrides.id_usuario`, p. ej. al copiar una campaña entera: la campaña nueva aún no es visible
    // fuera de la transacción); si no lo pasa, se calcula acá, así ningún llamador nuevo puede olvidarlo.
    const ownerId = overrides.id_usuario
        ?? (await getCampaignOwnerId(overrides.id_campana ?? sourceReport.id_campana))
        ?? sourceReport.id_usuario;
    const data = buildReportCopyData(sourceReport, { ...overrides, id_usuario: ownerId }, userId);
    const newReport = await md.reportes.create(data, { transaction });
    await copyReportChildren(sourceReport.id, newReport.id, userId, transaction);
    return newReport;
};

// 'YYYY-MM-DD' que además sea una fecha real (no 2026-02-31).
const isValidDateOnly = (value) => {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
    const parsed = parseISO(value);
    return !Number.isNaN(parsed.getTime()) && format(parsed, 'yyyy-MM-dd') === value;
};

const copyReport = async (req, res) => {
    const transaction = await md.sequelize.transaction();
    try {
        const { id, fecha_ini, fecha_fin } = req.body;
        const nombre = typeof req.body.nombre === 'string' ? req.body.nombre.trim() : '';
        const reject = async (message) => {
            await transaction.rollback();
            return res.status(400).json({ message });
        };

        if (!Number.isInteger(Number(id)) || !nombre) {
            return reject('Debe indicar el reporte de origen y un nombre.');
        }
        if (nombre.length > 200) {
            return reject('El nombre no puede superar los 200 caracteres.');
        }
        // Las fechas son opcionales, pero si vienen deben ser las dos, válidas y en orden:
        // antes un valor mal formado terminaba en un error 500 al guardar.
        if ((fecha_ini && !isValidDateOnly(fecha_ini)) || (fecha_fin && !isValidDateOnly(fecha_fin))) {
            return reject('Las fechas deben ser válidas y tener formato AAAA-MM-DD.');
        }
        if (!!fecha_ini !== !!fecha_fin) {
            return reject('Indique la fecha de inicio y la de fin, o deje ambas vacías.');
        }
        if (fecha_ini && fecha_fin && fecha_fin < fecha_ini) {
            return reject('La fecha de fin no puede ser anterior a la de inicio.');
        }

        const sourceReport = await md.reportes.findByPk(id, { transaction });
        if (!sourceReport) {
            await transaction.rollback();
            return res.status(404).json({ message: 'No se encontró el reporte a copiar' });
        }
        if (!(await canManageReport(req.user, sourceReport.id))) {
            await transaction.rollback();
            return denyAccess(res);
        }

        // Una copia nace activa, salvo que su campaña esté inactiva: un reporte no puede estar
        // activo bajo una campaña inactiva (ver la regla de reactivación en enableDisableReport).
        const campana = await md.campanas.findByPk(sourceReport.id_campana, { attributes: ['activo'], transaction });
        const overrides = {
            nombre,
            id_campana: sourceReport.id_campana,
            activo: !campana || campana.activo !== false,
            // La copia queda a nombre del responsable de la empresa, no de quien copia.
            id_usuario: (await getCampaignOwnerId(sourceReport.id_campana)) ?? req.user.id,
        };
        if (fecha_ini) {
            overrides.fecha_ini = fecha_ini;
            overrides.fecha_inicio = parseISO(fecha_ini);
        }
        if (fecha_fin) {
            overrides.fecha_fin = fecha_fin;
            overrides.fecha_final = parseISO(fecha_fin);
        }

        const newReport = await copyReportWithChildren(sourceReport, overrides, req.user.id, transaction);

        if (fecha_ini && fecha_fin) {
            await createDaysForReport(newReport.id, newReport.id_objetivo, fecha_ini, fecha_fin, req.user.id, transaction);
        }

        await transaction.commit();
        res.status(200).json({ message: 'Reporte copiado correctamente', data: newReport });
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({ message: `Error al copiar el reporte: ${error.message}` });
    }
};

const enableDisableReport = async (req, res) => {
    try {
        const { id } = req.params;
        const report = await md.reportes.findByPk(id);
        if (!report) {
            return res
                .status(404)
                .json({ message: 'No se encontró el reporte' });
        }
        if (!(await canManageReport(req.user, report.id))) {
            return denyAccess(res);
        }
        if (!report.activo && !(await isCampaignActive(report.id_campana))) {
            return res.status(409).json(INACTIVE_CAMPAIGN_ERROR);
        }
        report.activo = !report.activo;
        await report.save();
        res.status(200).json({
            message: 'Reporte actualizado correctamente',
            data: report,
        });
    } catch (error) {
        res.status(500).json({
            message: `Error al actualizar el reporte ${error.message}`,
        });
    }
};

const countRows = async (table, column, id) => {
    const [row] = await md.sequelize.query(
        `SELECT COUNT(*)::int AS count FROM ${table} WHERE ${column} = :id`,
        { replacements: { id }, type: md.Sequelize.QueryTypes.SELECT },
    );
    return row.count;
};

const deleteReport = async (req, res) => {
    try {
        const { id } = req.params;
        const report = await md.reportes.findByPk(id);
        if (!report) {
            return res
                .status(404)
                .json({ message: 'No se encontró el reporte para eliminar' });
        }
        if (!(await canManageReport(req.user, report.id))) {
            return denyAccess(res);
        }

        // tasks_cards y anuncios referencian al reporte sin ON DELETE CASCADE:
        // antes el borrado fallaba con un error de clave foránea. Se avisa con un
        // mensaje claro en vez de borrar tareas o anuncios en silencio.
        const [tareas, anuncios] = await Promise.all([
            countRows('tasks_cards', 'report_id', report.id),
            countRows('anuncios', 'report_id', report.id),
        ]);
        if (tareas > 0 || anuncios > 0) {
            const partes = [];
            if (tareas > 0) partes.push(`${tareas} tarea(s)`);
            if (anuncios > 0) partes.push(`${anuncios} anuncio(s)`);
            return res.status(409).json({
                message: `No se puede eliminar el reporte porque tiene ${partes.join(' y ')} asociado(s). Elimine primero esos elementos o deshabilite el reporte.`,
            });
        }

        // interaccion_edad y funnel_stage no tienen FK hacia reportes: se borran
        // a mano para no dejar filas huérfanas (el resto cae por ON DELETE CASCADE).
        const transaction = await md.sequelize.transaction();
        try {
            await md.interaccion_edad.destroy({ where: { id_reporte: report.id }, transaction });
            await md.funnel_stage.destroy({ where: { id_reporte: report.id }, transaction });
            await report.destroy({ transaction });
            await transaction.commit();
        } catch (error) {
            await transaction.rollback();
            throw error;
        }
        res.status(200).json({ message: 'Reporte eliminado correctamente' });
    } catch (error) {
        res.status(500).json({
            message: `Error al eliminar el reporte ${error.message}`,
        });
    }
};

// ************** SECONDARY OBJECTIVES

const getSecondaryObjectivesByReportId = async (req, res) => {
    try {
        const { report_id } = req.params;
        const objetivos_secundarios =
            await md.reporte_objetivos_secundarios.findAll({
                where: {
                    id_reporte: report_id,
                },
            });
        res.status(200).json(objetivos_secundarios);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener los objetivos secundarios ${error.message}`,
        });
    }
};

const saveUpdateSecondaryObjectives = async (req, res) => {
    const objetivos = req.body;
    const { report_id } = req.params;

    // Se reemplaza TODA la lista (borrar y recrear): se valida antes de tocar nada.
    if (!Array.isArray(objetivos)) {
        return res.status(400).json({ message: 'Se esperaba una lista de objetivos secundarios.' });
    }
    // `valor` es BIGINT en la base: solo enteros (un decimal fallaba al insertar, a mitad del guardado).
    const invalido = objetivos.find(
        (o) => !o || !Number.isInteger(Number(o.id_objetivo)) || (o.valor !== null && o.valor !== undefined && !Number.isInteger(Number(o.valor))),
    );
    if (invalido !== undefined) {
        return res.status(400).json({ message: 'Cada KPI secundario necesita un KPI válido y un valor numérico entero.' });
    }

    // En una transacción: antes, si fallaba una inserción a mitad de camino, el reporte
    // se quedaba sin sus KPI (ya se habían borrado).
    const transaction = await md.sequelize.transaction();
    try {
        await md.reporte_objetivos_secundarios.destroy({
            where: { id_reporte: report_id },
            transaction,
        });

        for (const objetivo of objetivos) {
            await md.reporte_objetivos_secundarios.create({
                id_reporte: report_id,
                id_objetivo: objetivo.id_objetivo,
                valor: objetivo.valor,
            }, { transaction });
        }

        await transaction.commit();
        res.status(200).json({
            message: 'Objetivos secundarios actualizados correctamente.',
        });
    } catch (error) {
        if (!transaction.finished) await transaction.rollback();
        res.status(500).json({
            message: `Error al actualizar los objetivos secundarios ${error.message}`,
        });
    }
};

// ************** REPORT DAYS

const getDaysByReportId = async (req, res) => {
    try {
        const { report_id } = req.params;
        const report = await md.reportes.findByPk(report_id, {
            attributes: ['id', 'id_objetivo'],
        });
        if (!report) {
            return res
                .status(404)
                .json({ message: 'No se encontró el reporte' });
        }
        const reporte_dias = await md.reporte_dia.findAll({
            where: {
                id_reporte: report_id,
                id_objetivo: report.id_objetivo,
            },
            order: [
                ['anio', 'ASC'],
                ['mes', 'ASC'],
                ['dia', 'ASC'],
            ],
            attributes: {
                exclude: [
                    'usuario_creacion',
                    'usuario_modificacion',
                    'usuario_eliminacion',
                    'fecha_modificacion',
                    'fecha_eliminacion',
                ],
            },
        });
        res.status(200).json(reporte_dias);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener los días del reporte ${error.message}`,
        });
    }
};

/**
 * Actualiza múltiples días en reporte_dia para un reporte y objetivo específicos.
 * @param {Request} req
 * @param {Response} res
 * @return {Promise<void>}
 */
const updateAllDaysByReportAndObjetivo = async (req, res) => {
    try {
        const { report_id } = req.params;
        const { days } = req.body;

        const report = await md.reportes.findByPk(report_id, {
            attributes: ['id', 'id_objetivo'],
        });
        if (!report) {
            return res
                .status(404)
                .json({ message: 'No se encontró el reporte' });
        }
        for (const day of days) {
            await md.reporte_dia.update(
                { valor: day.valor },
                {
                    where: {
                        id_reporte: report_id,
                        id_objetivo: report.id_objetivo,
                        dia: day.dia,
                        mes: day.mes,
                        anio: day.anio,
                    },
                },
            );
        }
        res.status(200).send({
            message: 'Valores actualizados correctamente en reporte_dia.',
        });
    } catch (error) {
        res.status(500).send({
            message:
                'Ocurrió un error al guardar el valor en reporte_dia. ' + error,
        });
    }
};

const updateReporteDia = async (req, res) => {
    try {
        const { id, valor, id_reporte } = req.body;
        if (!Number.isInteger(Number(id)) || !Number.isFinite(Number(valor))) {
            return res.status(400).send({ message: 'El id y el valor del día deben ser numéricos.' });
        }
        await md.reporte_dia.update(
            {
                valor: valor,
            },
            {
                where: {
                    id: id,
                },
            },
        );
        const reporte = await md.reportes.findByPk(id_reporte);
        // const total_valor = await updateKPI(reporte);
        res.status(200).send({
            message: 'Valor actualizado correctamente en reporte_dia.',
        });
    } catch (error) {
        res.status(500).send({
            message:
                'Ocurrió un error al guardar el valor en reporte_dia. ' + error,
        });
    }
};

// ************** REPORT GENRES

/**
 * Obtiene los géneros por ID de reporte.
 * @param {*} req - Request con parámetro report_id
 * @param {*} res - Response con los datos del género del reporte
 * @return {Promise<void>}
 */
const getGenderByReportId = async (req, res) => {
    try {
        const { report_id } = req.params;
        const reporte_genero = await md.interaccion_genero.findOne({
            where: {
                id_reporte: parseInt(report_id),
            },
        });
        res.status(200).json(reporte_genero);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener el género del reporte ${error.message}`,
        });
    }
};

const saveUpdateGender = async (req, res) => {
    try {
        const body = req.body;
        const { report_id } = req.params;
        let reporte_genero = await md.interaccion_genero.findOne({
            where: {
                id_reporte: parseInt(report_id),
            },
        });
        if (reporte_genero) {
            await reporte_genero.update(body);
        } else {
            body.id_reporte = parseInt(report_id);
            body.usuario_creacion = req.user.id;
            reporte_genero = await md.interaccion_genero.create(body);
        }
        res.status(200).json({
            message: 'Género guardado correctamente.',
            data: reporte_genero,
        });
    } catch (error) {
        res.status(500).json({
            message: `Error al guardar/actualizar el género del reporte ${error.message}`,
        });
    }
};

// ************** REPORT DEVICES

/**
 * Obtiene los dispositivos por ID de reporte.
 * @param {*} req - Request con parámetro report_id
 * @param {*} res - Response con los datos de dispositivos del reporte
 * @return {Promise<void>}
 */
const getDevicesByReportId = async (req, res) => {
    try {
        const { report_id } = req.params;
        const reporte_dispositivos = await md.interaccion_dispositivo.findOne({
            where: {
                id_reporte: parseInt(report_id),
            },
            attributes: {
                exclude: [
                    'usuario_creacion',
                    'usuario_modificacion',
                    'usuario_eliminacion',
                    'fecha_modificacion',
                    'fecha_eliminacion',
                ],
            },
        });
        res.status(200).json(reporte_dispositivos);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener los dispositivos del reporte ${error.message}`,
        });
    }
};

const saveUpdateDevices = async (req, res) => {
    try {
        const body = req.body;
        const { report_id } = req.params;
        let reporte_dispositivos = await md.interaccion_dispositivo.findOne({
            where: {
                id_reporte: parseInt(report_id),
            },
        });
        if (reporte_dispositivos) {
            await reporte_dispositivos.update(body);
        } else {
            body.id_reporte = parseInt(report_id);
            body.usuario_creacion = req.user.id;
            reporte_dispositivos =
                await md.interaccion_dispositivo.create(body);
        }
        res.status(200).json({
            message: 'Dispositivos guardados correctamente.',
            data: reporte_dispositivos,
        });
    } catch (error) {
        res.status(500).json({
            message: `Error al guardar/actualizar los dispositivos del reporte ${error.message}`,
        });
    }
};

// ************** REPORT HOURS

/**
 * Obtiene las horas por ID de reporte.
 * @param {*} req - Request con parámetro report_id
 * @param {*} res - Response con los datos de horas del reporte
 * @return {Promise<void>}
 */
const getHoursByReportId = async (req, res) => {
    try {
        const { report_id } = req.params;
        const reporte_horas = await md.interaccion_hora.findOne({
            where: {
                id_reporte: parseInt(report_id),
            },
            attributes: {
                exclude: [
                    'usuario_creacion',
                    'usuario_modificacion',
                    'usuario_eliminacion',
                    'fecha_modificacion',
                    'fecha_eliminacion',
                ],
            },
        });
        res.status(200).json(reporte_horas);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener las horas del reporte ${error.message}`,
        });
    }
};

/** Guarda o actualiza las horas por ID de reporte.
 * @param {*} req - Request con parámetro report_id y body con datos de horas
 * @param {*} res - Response con los datos guardados o actualizados de horas del reporte
 * @return {Promise<void>}
 */
const saveUpdateHours = async (req, res) => {
    try {
        const body = req.body;
        const { report_id } = req.params;
        let reporte_horas = await md.interaccion_hora.findOne({
            where: {
                id_reporte: parseInt(report_id),
            },
            attributes: {
                exclude: [
                    'usuario_creacion',
                    'usuario_modificacion',
                    'usuario_eliminacion',
                    'fecha_modificacion',
                    'fecha_eliminacion',
                ],
            },
        });
        if (reporte_horas) {
            await reporte_horas.update(body);
        } else {
            body.id_reporte = parseInt(report_id);
            body.usuario_creacion = req.user.id;
            reporte_horas = await md.interaccion_hora.create(body);
        }
        res.status(200).json({
            message: 'Horas guardadas correctamente.',
            data: reporte_horas,
        });
    } catch (error) {
        res.status(500).json({
            message: `Error al guardar/actualizar las horas del reporte ${error.message}`,
        });
    }
};

// ************** REPORT VIEW ADS

/** Obtiene los ADS cargados por ID de reporte.
 * @param {*} req - Request con parámetro report_id
 * @param {*} res - Response con los datos de anuncios vistos del reporte
 * @return {Promise<void>}
 */
const getViewAdsByReportId = async (req, res) => {
    try {
        const { report_id } = req.params;
        const { width, quality = 'auto', fetch_format = 'auto' } = req.query;
        const options = {
            quality,
            fetch_format,
            secure: true,
        };
        const reporte_view_ads = await md.view_ads.findAll({
            where: {
                id_reporte: parseInt(report_id),
            },
            attributes: {
                exclude: [
                    'usuario_creacion',
                    'usuario_modificacion',
                    'usuario_eliminacion',
                    'fecha_modificacion',
                    'fecha_eliminacion',
                ],
            },
        });
        if (width) {
            options.width = parseInt(width);
            options.crop = 'limit';
        }
        for (const ad of reporte_view_ads) {
            // 'imagen' = archivo legacy compartido con el backend antiguo (filesystem).
            // 'image_url' = subido desde el sistema nuevo a Cloudinary (public_id).
            if (ad.image_url) {
                ad.dataValues.image_url = cloudinary.url(ad.image_url, options);
                ad.dataValues.url = ad.dataValues.image_url;
            } else {
                ad.dataValues.url = ad.imagen_url_completa;
            }
        }

        res.status(200).json(reporte_view_ads);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener los ADS asociados del reporte ${error.message}`,
        });
    }
};

const saveUpdateViewAds = async (req, res) => {
    try {
        const body = req.body;
        const { report_id } = req.params;
        let reporte_view_ads = await md.interaccion_view_ads.findOne({
            where: {
                id_reporte: parseInt(report_id),
            },
        });
        if (reporte_view_ads) {
            await reporte_view_ads.update(body);
        } else {
            reporte_view_ads = await md.interaccion_view_ads.create(body);
        }
        res.status(200).json({
            message: 'Imagen de anuncio guardado correctamente.',
            data: reporte_view_ads,
        });
    } catch (error) {
        res.status(500).json({
            message: `Error al guardar/actualizar los anuncios vistos del reporte ${error.message}`,
        });
    }
};

const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/svg+xml': '.svg',
};

const AD_IMAGE_MAX_WIDTH = 1600;
const AD_IMAGE_QUALITY = 80;

/**
 * Redimensiona/comprime una imagen de anuncio para que no ocupe espacio de más:
 * se ve en un "Panel de Campaña", no necesita resolución completa de cámara.
 * No agranda imágenes más chicas que el máximo. SVG se deja intacto (es vectorial).
 * @param {Buffer} buffer - contenido original del archivo
 * @param {string} mimetype - mimetype reportado por multer
 * @returns {Promise<Buffer>}
 */
const resizeAdImage = async (buffer, mimetype) => {
    if (mimetype === 'image/svg+xml') return buffer;

    let pipeline = sharp(buffer, { animated: mimetype === 'image/gif' }).resize({
        width: AD_IMAGE_MAX_WIDTH,
        withoutEnlargement: true,
    });

    if (mimetype === 'image/jpeg') {
        pipeline = pipeline.jpeg({ quality: AD_IMAGE_QUALITY });
    } else if (mimetype === 'image/png') {
        pipeline = pipeline.png({ quality: AD_IMAGE_QUALITY });
    } else if (mimetype === 'image/webp') {
        pipeline = pipeline.webp({ quality: AD_IMAGE_QUALITY });
    }
    // gif y otros formatos soportados por sharp: se redimensionan sin recomprimir

    return pipeline.toBuffer();
};

const uploadAdImage = async (req, res) => {
    try {
        const { report_id } = req.params;
        const file = req.file;

        if (!file) {
            return res
                .status(400)
                .json({ message: 'No se ha subido ninguna imagen.' });
        }

        if (!process.env.LEGACY_ADS_UPLOADS_PATH) {
            return res.status(500).json({
                message: 'LEGACY_ADS_UPLOADS_PATH no está configurado en el servidor.',
            });
        }

        // Se guarda en la MISMA carpeta que usa el backend antiguo (compartida por
        // filesystem, no por copia), para que la imagen sea visible desde ambos
        // sistemas. El nombre usa un UUID: el backend antiguo nombra sus archivos
        // con Date.now() (solo dígitos), así que no hay riesgo de colisión.
        const extension = path.extname(file.originalname) || MIME_TO_EXT[file.mimetype] || '.png';
        const filename = `${crypto.randomUUID()}${extension}`;
        const destination = path.join(process.env.LEGACY_ADS_UPLOADS_PATH, filename);

        const resizedBuffer = await resizeAdImage(file.buffer, file.mimetype);
        await fs.promises.writeFile(destination, resizedBuffer);

        // mismo criterio de 'orden' que usa el backend antiguo (contar + 1), para
        // que una imagen subida desde acá aparezca al final de la galería ahí también.
        const existingCount = await md.view_ads.count({
            where: { id_reporte: parseInt(report_id) },
        });

        await md.view_ads.create({
            id_reporte: parseInt(report_id),
            usuario_creacion: req.user.id,
            imagen: filename,
            orden: existingCount + 1,
        });

        res.status(200).json({
            message: 'Imagen de anuncio subida exitosamente.',
        });
    } catch (error) {
        res.status(500).json({
            message: `Error al subir la imagen del anuncio ${error.message}`,
        });
    }
};

const deleteAdImage = async (req, res) => {
    try {
        const { id } = req.params;
        const viewAd = await md.view_ads.findByPk(id);
        if (!viewAd) {
            return res.status(404).json({
                message: 'No se encontró la imagen del anuncio para eliminar',
            });
        }

        // Al copiar un reporte, los anuncios de la copia apuntan al MISMO archivo que los del
        // original. Solo se borra el archivo cuando ningún otro anuncio lo usa; si no, quitar un
        // anuncio de la copia dejaba rota la imagen del original (y al revés).
        const fileColumn = viewAd.image_url ? 'image_url' : viewAd.imagen ? 'imagen' : null;
        const sharedWithOthers = fileColumn
            ? (await md.view_ads.count({ where: { id: { [Op.ne]: viewAd.id }, [fileColumn]: viewAd[fileColumn] } })) > 0
            : false;

        if (!sharedWithOthers) {
            if (viewAd.image_url) {
                await cloudinary.uploader.destroy(viewAd.image_url);
            } else if (viewAd.imagen && process.env.LEGACY_ADS_UPLOADS_PATH) {
                const filePath = path.join(process.env.LEGACY_ADS_UPLOADS_PATH, viewAd.imagen);
                await fs.promises.unlink(filePath).catch(() => {
                    // si el archivo ya no está en disco, igual se elimina el registro
                });
            }
        }
        await viewAd.destroy();

        res.status(200).json({
            message: 'Imagen de anuncio eliminada exitosamente.',
        });
    } catch (error) {
        res.status(500).json({
            message: `Error al eliminar la imagen del anuncio ${error.message}`,
        });
    }
};

// ************** REPORT MAP

// Guarda el título y/o el enlace de UN anuncio (view_ads). Se llama al instante desde el
// modal "Editar Anuncio": no depende de "Guardar todo". Solo se tocan los campos que vienen
// en el body; un texto vacío los limpia.
const updateViewAd = async (req, res) => {
    try {
        const { id } = req.params;
        const viewAd = await md.view_ads.findByPk(id);
        if (!viewAd) {
            return res.status(404).json({ message: 'No se encontró el anuncio.' });
        }
        if (!(await canManageReport(req.user, viewAd.id_reporte))) {
            return denyAccess(res);
        }

        const updates = {};
        if ('title' in req.body) {
            const title = String(req.body.title ?? '').trim();
            if (title.length > 300) {
                return res.status(400).json({ message: 'El título no puede superar los 300 caracteres.' });
            }
            updates.title = title || null;
        }
        if ('link_end_point' in req.body) {
            const link = String(req.body.link_end_point ?? '').trim();
            if (link) {
                // Solo enlaces http(s): el enlace se muestra como <a href> al cliente.
                let parsed;
                try {
                    parsed = new URL(link);
                } catch {
                    parsed = null;
                }
                if (!parsed || !['http:', 'https:'].includes(parsed.protocol)) {
                    return res.status(400).json({ message: 'La URL del anuncio no es válida (debe empezar con http:// o https://).' });
                }
            }
            updates.link_end_point = link || null;
        }

        await viewAd.update({
            ...updates,
            usuario_modificacion: req.user.id,
            fecha_modificacion: new Date(),
        });
        res.status(200).json({
            message: 'Anuncio actualizado correctamente.',
            data: { id: viewAd.id, title: viewAd.title, link_end_point: viewAd.link_end_point },
        });
    } catch (error) {
        res.status(500).json({
            message: `Error al actualizar el anuncio ${error.message}`,
        });
    }
};

const getMapByReportID = async (req, res) => {
    try {
        const { report_id } = req.params;
        const report = await md.reportes.findOne({
            where: {
                id: report_id,
            },
            attributes: ['id_mapa'],
        });
        if (!report) {
            return res
                .status(400)
                .json({ message: `Reporte no encontrado con ID ${report_id}` });
        }
        let model = null;
        if (report.id_mapa === 1) {
            // Bolivia
            model = md.mapa_bolivia;
        } else if (report.id_mapa === 2) {
            // Ontario GTA
            model = md.mapa_ontario_gta;
        } else if (report.id_mapa === 3) {
            // Paraguay
            model = md.mapa_paraguay;
        } else if (report.id_mapa === 4) {
            // USA
            model = md.mapa_usa;
        } else if (report.id_mapa === 5) {
            // Ecuador
            model = md.mapa_ecuador;
        } else if (report.id_mapa === 6) {
            // Argentina
            model = md.mapa_argentina;
        } else {
            return res.status(400).json({
                message: `Mapa no encontrado con ID ${report.id_mapa}`,
            });
        }
        const map_data = await model.findOne({
            where: {
                id_reporte: report_id,
            },
            attributes: {
                exclude: [
                    'usuario_creacion',
                    'usuario_modificacion',
                    'usuario_eliminacion',
                    'fecha_modificacion',
                    'fecha_eliminacion',
                ],
            },
        });
        res.status(200).json(map_data);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener el mapa ${error.message}`,
        });
    }
};

// ************** DASHBOARD
const getDashboardData = async (req, res) => {
    try {
        const { campaign_id } = req.params;
        const campanas = await md.campanas.findByPk(campaign_id, {
            attributes: [
                'id',
                'activo',
                [
                    md.Sequelize.fn(
                        'TRIM',
                        md.Sequelize.col('campanas.nombre'),
                    ),
                    'nombre',
                ],
            ],
            include: [
                {
                    model: md.categorias,
                    as: 'categoria',
                    attributes: ['id', 'activo'],
                    include: [
                        {
                            model: md.empresas,
                            as: 'empresa',
                            attributes: ['id', 'activo'],
                        },
                    ],
                },
                {
                    model: md.reportes,
                    where: {
                        activo: true,
                    },
                    required: false,
                    as: 'reportes',
                    attributes: [
                        'id',
                        'nombre',
                        'fecha_ini',
                        'fecha_fin',
                        'objetivo_proyectado',
                        'id_objetivo',
                        'cp',
                        'presupuesto',
                    ],
                    include: [
                        {
                            model: md.reporte_dia,
                            where: md.Sequelize.where(
                                md.Sequelize.col(
                                    'reportes->reporte_dia.id_objetivo',
                                ),
                                Op.eq,
                                md.Sequelize.col('reportes.id_objetivo'),
                            ),
                            required: false,
                            as: 'reporte_dia',
                            attributes: [
                                'id',
                                'valor',
                                'dia',
                                'mes',
                                'anio',
                                'id_reporte',
                            ],
                        },
                        {
                            model: md.plataformas,
                            as: 'plataforma',
                            attributes: ['id', 'plataforma'],
                        },
                        {
                            model: md.objetivos,
                            as: 'objetivo',
                            attributes: ['id', 'objetivo'],
                        },
                        {
                            model: md.reporte_objetivos_secundarios,
                            as: 'objetivos_secundarios',
                            attributes: ['id_objetivo', 'valor'],
                            include: [
                                {
                                    model: md.objetivos,
                                    as: 'objetivo',
                                    attributes: ['id', 'objetivo'],
                                },
                            ],
                        },
                        {
                            model: md.interaccion_dispositivo,
                            as: 'dispositivos',
                            attributes: [
                                'id',
                                'porcentaje_tablet',
                                'porcentaje_smartphone',
                                'porcentaje_laptop',
                            ],
                        },
                        {
                            model: md.interaccion_edad,
                            as: 'edades',
                            attributes: [
                                'id',
                                'porcentaje1',
                                'porcentaje2',
                                'porcentaje3',
                                'porcentaje4',
                                'porcentaje5',
                                'porcentaje6',
                                'porcentaje7',
                                'porcentaje0',
                            ],
                        },
                        {
                            model: md.interaccion_hora,
                            as: 'horas',
                            attributes: [
                                'id',
                                'h1',
                                'h2',
                                'h3',
                                'h4',
                                'h5',
                                'h6',
                                'h7',
                                'h8',
                                'h9',
                                'h10',
                                'h11',
                                'h12',
                                'h13',
                                'h14',
                                'h15',
                                'h16',
                                'h17',
                                'h18',
                                'h19',
                                'h20',
                                'h21',
                                'h22',
                                'h23',
                                'h24',
                            ],
                        },
                        {
                            model: md.mapa_bolivia,
                            as: 'mapa_bolivia',
                            attributes: [
                                'id',
                                'lapaz',
                                'santacruz',
                                'cochabamba',
                                'oruro',
                                'tarija',
                                'pando',
                                'beni',
                                'sucre',
                                'potosi',
                            ],
                        },
                        {
                            model: md.interaccion_genero,
                            as: 'generos',
                            attributes: ['id', 'porcentaje', 'genero'],
                        },
                        {
                            model: md.segmentacion,
                            as: 'segmentacion',
                            attributes: [
                                'id',
                                'segmentacion',
                                'demografia',
                                'geo_segmentacion',
                                'retargeting',
                                'learning',
                                'palabras_clave',
                            ],
                        },
                        {
                            model: md.funnel_stage,
                            as: 'funnel_stage',
                            attributes: [
                                'id',
                                'punto1',
                                'punto2',
                                'punto3',
                                'punto4',
                                'activo',
                            ],
                        },
                        {
                            model: md.view_ads,
                            as: 'view_ads',
                            attributes: [
                                'id',
                                'imagen',
                                'link_end_point',
                                'title',
                                'image_url',
                                'imagen_url_completa',
                            ],
                        },
                    ],
                },
            ],
        });
        if (!campanas) {
            return res
                .status(404)
                .json({ message: 'No se encontró la campaña' });
        }
        // La campaña (o su categoría/empresa) puede estar desactivada aunque
        // sus reportes individuales todavía tengan activo:true — no basta con
        // el filtro de reportes de más abajo, hay que validar toda la cadena.
        const empresaActiva = campanas.categoria?.empresa?.activo;
        const categoriaActiva = campanas.categoria?.activo;
        if (!campanas.activo || !categoriaActiva || !empresaActiva) {
            return res.status(403).json({ message: 'Esta campaña ya no está disponible.' });
        }
        const resultado = campanas.toJSON();
        delete resultado.categoria;
        for (const reporte of resultado.reportes) {
            reporte.percent = await percentDias(reporte, reporte.id_objetivo);
            reporte.objetivo_logrado = await getObjetivoLogrado(
                reporte.id,
                reporte.id_objetivo,
            );

            let progreso = await getProgresoPresupuesto(
                reporte.objetivo_logrado,
                reporte,
            );
            reporte.progreso_presupuesto = progreso.monto;
            reporte.porcentaje_presupuesto = progreso.porcentaje;

            for (const objetivo_secundario of reporte.objetivos_secundarios) {
                objetivo_secundario.percent = await percentDias(
                    reporte,
                    objetivo_secundario.id_objetivo,
                );
                objetivo_secundario.objetivo_logrado =
                    objetivo_secundario.valor;
            }
        }
        res.status(200).json(resultado);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener los datos del dashboard ${error.message}`,
        });
    }
};

// ************** RESUMEN DE CLIENTE (Summary)

// IDs fijos de la tabla `objetivos` (confirmados contra la BD): "Impresiones" y
// "Alcance" nunca son un campo propio de `reportes` — se leen como el objetivo
// principal del reporte (si coincide) o, si no, como un objetivo secundario
// guardado en `reporte_objetivos_secundarios`. Misma lógica que usaba la vista
// legacy `report_by_client` y el front antiguo (`findAlcance`/`impresiones`),
// solo que acá se resuelve en JS reutilizando los helpers ya compartidos con
// el dashboard, no con las funciones SQL viejas.
const OBJETIVO_IMPRESIONES_ID = 3;
const OBJETIVO_ALCANCE_ID = 7;

const getSecundarioValor = (reporte, idObjetivo) => {
    const secundario = reporte.objetivos_secundarios?.find((s) => s.id_objetivo === idObjetivo);
    return Number(secundario?.valor) || 0;
};

// Extraída aparte de getSummaryForClientMenu (que la llama para responder el
// HTTP request) porque el asistente IA del cliente (server/assistant_ai/
// controller/client_assistant_ai.controller.js) también la necesita: le da
// exactamente los mismos datos ya escoped a `empresaId`, así que la IA nunca
// tiene forma de ver campañas de otra empresa (no es una regla de prompt,
// es que el dato de otras empresas ni siquiera llega a construirse).
const getClientSummaryRows = async (empresaId) => {
    const fechaActual = getFechaActualLaPaz();

    const campanas = await md.campanas.findAll({
        where: {
            activo: true,
            // Las campañas "servicio" (branding/diseño, sin métricas de medios) no
            // entran al Resumen — mismo filtro que usaba report_by_client.
            servicio: { [Op.not]: true },
        },
        attributes: ['id', 'nombre', 'mes', 'gestion', 'moneda'],
        include: [
            {
                model: md.categorias,
                as: 'categoria',
                attributes: ['id', 'nombre'],
                where: { id_empresa: empresaId, activo: true },
                required: true,
            },
            {
                model: md.reportes,
                as: 'reportes',
                where: {
                    activo: true,
                    presupuesto: { [Op.ne]: null },
                    fecha_ini: { [Op.ne]: null },
                },
                required: false,
                attributes: [
                    'id', 'nombre', 'fecha_ini', 'fecha_fin', 'presupuesto',
                    'objetivo_proyectado', 'id_objetivo', 'cp', 'ctr', 'conversiones',
                ],
                include: [
                    { model: md.plataformas, as: 'plataforma', attributes: ['id', 'plataforma'] },
                    { model: md.objetivos, as: 'objetivo', attributes: ['id', 'objetivo'] },
                    {
                        model: md.reporte_objetivos_secundarios,
                        as: 'objetivos_secundarios',
                        attributes: ['id_objetivo', 'valor'],
                    },
                ],
            },
        ],
        order: [['gestion', 'DESC'], ['fecha_creacion', 'DESC']],
    });

    const filas = [];
    for (const campanaInstance of campanas) {
        const campana = campanaInstance.toJSON();
        for (const reporte of campana.reportes) {
            const objetivoLogrado = Number(await getObjetivoLogrado(reporte.id, reporte.id_objetivo)) || 0;
            const progreso = await getProgresoPresupuesto(objetivoLogrado, reporte);
            const presupuestoGastado = progreso.monto;
            const presupuestoTotal = Number(reporte.presupuesto) || 0;

            // Sin cap en 100 (a diferencia del `porcentaje_presupuesto` que usa el
            // dashboard para su barra de progreso): acá interesa mostrar si hubo
            // sobre-ejecución de presupuesto, igual que la tabla vieja.
            const cumplimiento = presupuestoTotal > 0
                ? Math.round((presupuestoGastado / presupuestoTotal) * 100)
                : 0;

            const objetivoProyectado = Number(reporte.objetivo_proyectado) || 0;
            const efectividad = objetivoProyectado > 0
                ? Math.round((objetivoLogrado / objetivoProyectado) * 100)
                : 0;

            const impresiones = reporte.id_objetivo === OBJETIVO_IMPRESIONES_ID
                ? objetivoLogrado
                : getSecundarioValor(reporte, OBJETIVO_IMPRESIONES_ID);
            const alcance = getSecundarioValor(reporte, OBJETIVO_ALCANCE_ID);

            const cp = Number(reporte.cp) || 0;
            const costo = cp > 0
                ? cp
                : (objetivoLogrado > 0 ? Math.round((presupuestoTotal / objetivoLogrado) * 100) / 100 : 0);

            const conversiones = Number(reporte.conversiones) || 0;
            let cpa = 0;
            if (conversiones > 0) {
                const fechaIni = parseToDate(reporte.fecha_ini);
                const fechaFin = parseToDate(reporte.fecha_fin);
                const reporteActivo = fechaIni && fechaFin && fechaActual >= fechaIni && fechaActual <= fechaFin;
                cpa = Math.round(((reporteActivo ? presupuestoGastado : presupuestoTotal) / conversiones) * 100) / 100;
            }

            filas.push({
                reporte_id: reporte.id,
                formato: reporte.nombre,
                campana_id: campana.id,
                campana_nombre: campana.nombre,
                mes: campana.mes,
                gestion: campana.gestion,
                categoria_id: campana.categoria.id,
                categoria_nombre: campana.categoria.nombre,
                fecha_ini: reporte.fecha_ini,
                fecha_fin: reporte.fecha_fin,
                plataforma: reporte.plataforma?.plataforma || null,
                moneda: campana.moneda,
                presupuesto_total: presupuestoTotal,
                presupuesto_gastado: presupuestoGastado,
                cumplimiento,
                impresiones,
                alcance,
                objetivo_logrado: objetivoLogrado,
                objetivo_proyectado: objetivoProyectado,
                tipo_objetivo: reporte.objetivo?.objetivo || null,
                efectividad,
                ctr: Number(reporte.ctr) || 0,
                costo,
                conversiones,
                cpa,
            });
        }
    }

    return filas;
};

const getSummaryForClientMenu = async (req, res) => {
    try {
        const filas = await getClientSummaryRows(req.session.empresaId);
        res.status(200).json(filas);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el resumen: ${error.message}` });
    }
};

// ************** REPORT REVIEW

const reporteDiasReview = async (req, res) => {
    try {
        const { page, limit } = req.params;
        const offset = (page - 1) * limit;

        let body = req.body;

        if (!body.year || !body.month) {
            return res
                .status(400)
                .send({ message: 'El año y el mes son obligatorios.' });
        }

        // year/month se interpolan más abajo en un `literal` de SQL: se
        // fuerzan a enteros acotados para que nunca lleguen como texto libre.
        const year = Number.parseInt(body.year, 10);
        const month = Number.parseInt(body.month, 10);
        if (!Number.isInteger(year) || !Number.isInteger(month) || year < 2000 || year > 2100 || month < 1 || month > 12) {
            return res
                .status(400)
                .send({ message: 'El año y el mes no son válidos.' });
        }

        // let days_in_month = moment(year + '-' + month).daysInMonth();
        let days_in_month = DateTime.fromObject({
            year,
            month,
        }).daysInMonth;

        let query = {
            fecha_inicio: { [md.Sequelize.Op.ne]: null },
            presupuesto: { [md.Sequelize.Op.ne]: null },
            // servicio:true,
            [md.Sequelize.Op.and]: [
                md.sequelize.literal(
                    `(fecha_inicio >= '${year}-${month}-1' AND fecha_inicio <= '${year}-${month}-${days_in_month}') OR (fecha_final >= '${year}-${month}-1' AND fecha_final <= '${year}-${month}-${days_in_month}')`,
                ),
            ],
        };

        if (body.users && body.users.length > 0) {
            query.id_usuario = { [md.Sequelize.Op.in]: body.users };
        }

        if (body.id_plataforma && body.id_plataforma != undefined) {
            query.id_plataforma = body.id_plataforma;
        }

        if (body.id_campana && body.id_campana != undefined) {
            query.id_campana = body.id_campana;
        }

        if (body.estado_pauta && body.estado_pauta != undefined) {
            query.estado_pauta =
                body.estado_pauta == 'abierta'
                    ? true
                    : body.estado_pauta == 'cerrada'
                      ? false
                      : '';
        }

        if (body.status_pago && body.status_pago != undefined) {
            query.pagado =
                body.status_pago == 'pagado'
                    ? true
                    : body.status_pago == 'impago'
                      ? false
                      : '';
        }

        if (body.cta_title && body.cta_title != undefined) {
            query.cta_title = body.cta_title;
        }
        const { id_categoria, id_empresa } = req.body;
        let includes = [
            {
                model: md.reporte_dia,
                as: 'reporte_dia',
                // add attribute id_usuario from id_reporte.id_usuario
                attributes: ['id', 'valor', 'dia', 'mes', 'anio', 'id_reporte'],
                where: {
                    id_objetivo: md.sequelize.fn(
                        '',
                        md.sequelize.col('reportes.id_objetivo'),
                    ),
                },
                required: false,
            },
        ];
        if (id_categoria || id_empresa) {
            const includeCampana = {
                model: md.campanas,
                as: 'campanas',
                attributes: ['id', 'nombre'], // No devuelve datos de Campana (solo para JOIN)
                required: true, // INNER JOIN
            };

            // Si hay filtro por categoría o empresa, incluye Categoria
            if (id_categoria || id_empresa) {
                includeCampana.include = [
                    {
                        model: md.categorias,
                        as: 'categorias',
                        attributes: ['id', 'nombre'],
                        required: true,
                    },
                ];

                // Si hay filtro por empresa, añade Empresa al JOIN
                if (id_empresa) {
                    includeCampana.include[0].include = [
                        {
                            model: md.empresas,
                            as: 'empresas',
                            attributes: ['id', 'nombre'],
                            required: true,
                            where: { id: id_empresa }, // Filtro obligatorio si se envía
                        },
                    ];
                }
            }

            includes.push(includeCampana);
        }
        includes.push({
            model: md.campanas,
            as: 'campana',
            attributes: ['id', 'nombre', 'id_categoria'], // No devuelve datos de Campana (solo para JOIN)
            required: true, // INNER JOIN
            include: [
                {
                    model: md.categorias,
                    as: 'categoria',
                    attributes: ['id', 'nombre'],
                    required: false,
                    include: [
                        {
                            model: md.empresas,
                            as: 'empresa',
                            attributes: ['id', 'nombre'],
                            required: false,
                        },
                    ],
                },
            ],
        });
        const count = await md.reportes.findAndCountAll({
            where: query,
            attributes: ['id'],
            includes: includes,
        });
        const totalPages = count.count;
        const reportes = await md.reportes.findAll({
            where: query,
            offset: offset,
            limit: limit,
            include: includes,
            attributes: [
                'id',
                'fecha_inicio',
                'fecha_final',
                'nombre',
                'id_campana',
                'id_objetivo',
                'objetivo_proyectado',
                'id_usuario',
                'activo',
                [
                    md.sequelize.literal(`
                    (SELECT SUM(valor) 
                     FROM reporte_dia 
                     WHERE reporte_dia.id_reporte = reportes.id and reporte_dia.id_objetivo = reportes.id_objetivo)
                  `),
                    'sum_total',
                ],
            ],
            order: [
                [{ model: md.reporte_dia, as: 'reporte_dia' }, 'anio', 'ASC'],
                [{ model: md.reporte_dia, as: 'reporte_dia' }, 'mes', 'ASC'],
                [{ model: md.reporte_dia, as: 'reporte_dia' }, 'dia', 'ASC'],
            ],
            raw: false, // Para obtener instancias de Sequelize (mejor para relaciones)
        });

        res.status(200).send({
            totalPages: totalPages,
            items: reportes,
        });
    } catch (error) {
        console.log('error', error);
        res.status(500).send({
            message: 'Ocurrió un error al buscar los reportes. ' + error,
        });
    }
};

module.exports = {
    getById,
    getAll,
    getAllByCampaign,
    saveUpdate,
    enableDisableReport,
    deleteReport,
    getSecondaryObjectivesByReportId,
    saveUpdateSecondaryObjectives,
    updateAllDaysByReportAndObjetivo,
    getDaysByReportId,
    updateReporteDia,
    getGenderByReportId,
    saveUpdateGender,
    getDevicesByReportId,
    saveUpdateDevices,
    getHoursByReportId,
    saveUpdateHours,
    getViewAdsByReportId,
    saveUpdateViewAds,
    uploadAdImage,
    deleteAdImage,
    updateViewAd,
    getMapByReportID,
    reporteDiasReview,
    getDashboardData,
    getSummaryForClientMenu,
    getClientSummaryRows,
    copyReport,
    copyReportWithChildren,
};
