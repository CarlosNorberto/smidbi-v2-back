const md = require('../models');
const { DateTime } = require('luxon');
const { format, parse } = require('date-fns');
const { fromZonedTime } = require('date-fns-tz');

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        let { attributes } = req.query;
        attributes = attributes ? attributes.split(',') : null;
        const reporte = await md.reportes.scope('withSecondaryObjectives').findOne({
            where: {
                id: id,
                activo: true
            },
            attributes: attributes ? attributes : ['id', 'nombre', 'descripcion']
        });
        if (!reporte) {
            return res.status(404).json({ message: 'Reporte no encontrado' });
        }
        if (reporte.fecha_ini && reporte.fecha_fin) {
            const parsedDateIni = parse(reporte.fecha_ini, 'yyyy-MM-dd', new Date());
            const parsedDateFin = parse(reporte.fecha_fin, 'yyyy-MM-dd', new Date());
            reporte.dataValues.fecha_ini = format(parsedDateIni, 'yyyy-MM-dd');
            reporte.dataValues.fecha_fin = format(parsedDateFin, 'yyyy-MM-dd');
        }
        res.status(200).json(reporte);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el reporte: ${error.message}` });
    }
};

const getAllByCampaign = async (req, res) => {
    try {
        const { campaign_id } = req.params;
        const { page = 1, limit = 10, name = null } = req.query;
        const offset = (page - 1) * limit;
        let where = {
            id_campana: campaign_id
        };
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        const reportes = await md.reportes.scope(['withCampaign', 'withPlatform']).findAndCountAll({
            where: where,
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_modificacion', 'fecha_eliminacion'],
            },
            order: [['id', 'DESC']],
            limit,
            offset,
        });
        res.status(200).json(reportes);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los reportes ${error.message}` });
    }
};

const getAllByUser = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.params;
        const offset = (page - 1) * limit;
        let where = {
            id_usuario: req.user.id,
            activo: true
        };
        if (req.body) {
            const { name } = req.body;
            if (name) {
                where.nombre = {
                    [md.Sequelize.Op.iLike]: `%${name}%`
                };
            }
        }
        const reportes = await md.reportes.findAndCountAll({
            where: where,
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_modificacion', 'fecha_eliminacion'],
                include: [
                    // Mantener el campo original
                    'fecha_inicio',
                    // Agregar campo convertido con alias distinto
                    [
                        md.Sequelize.literal(`
                    to_char(
                        fecha_inicio AT TIME ZONE 'America/La_Paz' 
                        AT TIME ZONE '${req.user.time_zone || 'UTC'}',
                        'YYYY-MM-DD HH24:MI:SS'
                    )
                `),
                        'fecha_inicio_local'  // Usar un alias diferente
                    ]
                ]
            },
            order: [['id', 'DESC']],
            limit,
            offset,
        });
        res.status(200).json(reportes);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los reportes ${error.message}` });
    }
}

const saveUpdate = async (req, res) => {
    try {
        let body = req.body;
        body.id_usuario = req.user.id;
        let report = null;
        if(body.id){
            report = await md.reportes.findByPk(body.id);
            if (report) {
                await report.update(body);
                return res.status(200).json(report);
            }else{
                return res.status(404).json({ message: 'No se encontró el reporte para actualizar' });
            }
        }else{
            report = await md.reportes.create(body);
        }
        res.status(201).json(report);
    } catch (error) {
        res.status(500).json({ message: `Error al guardar el reporte ${error.message}` });
    }
};

// ************** REPORT DAYS

const getDaysByReportId = async (req, res) => {
    try {
        const { report_id } = req.params;
        const report = await md.reportes.findByPk(report_id, {
            attributes: ['id', 'id_objetivo']
        });
        if (!report) {
            return res.status(404).json({ message: 'No se encontró el reporte' });
        }
        const reporte_dias = await md.reporte_dia.findAll({
            where: {
                id_reporte: report_id,
                id_objetivo: report.id_objetivo
            },
            order: [['anio', 'ASC'], ['mes', 'ASC'], ['dia', 'ASC']],
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_modificacion', 'fecha_eliminacion'],
            }
        });
        res.status(200).json(reporte_dias);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los días del reporte ${error.message}` });
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
            attributes: ['id', 'id_objetivo']
        });
        if (!report) {
            return res.status(404).json({ message: 'No se encontró el reporte' });
        }        
        for (const day of days) {
            await md.reporte_dia.update({ valor: day.valor }, {
                where: {
                    id_reporte: report_id,
                    id_objetivo: report.id_objetivo,
                    dia: day.dia,
                    mes: day.mes,
                    anio: day.anio
                }
            });
        }
        res.status(200).send({ message: "Valores actualizados correctamente en reporte_dia." });
    } catch (error) {
        res.status(500).send({ message: "Ocurrió un error al guardar el valor en reporte_dia. " + error });
    }
}

const updateReporteDia = async (req, res) => {
    try {
        const { id, valor, id_reporte } = req.body;
        await md.reporte_dia.update({
            valor: valor
        }, {
            where: {
                id: id
            }
        });
        const reporte = await md.reportes.findByPk(id_reporte);
        // const total_valor = await updateKPI(reporte);
        res.status(200).send(reporte);
    } catch (error) {
        res.status(500).send({ message: "Ocurrió un error al guardar el valor en reporte_dia. " + error });
    }
}

const reporteDiasReview = async (req, res) => {
    try {
        const { page, limit } = req.params;
        const offset = (page - 1) * limit;

        let body = req.body;

        if (!body.year || !body.month) {
            return res.status(400).send({ message: "El año y el mes son obligatorios." });
        }

        // let days_in_month = moment(body.year + '-' + body.month).daysInMonth();
        let days_in_month = DateTime.fromObject({
            year: body.year,
            month: body.month
        }).daysInMonth;

        let query = {
            fecha_inicio: { [md.Sequelize.Op.ne]: null },
            presupuesto: { [md.Sequelize.Op.ne]: null },
            // servicio:true,
            [md.Sequelize.Op.and]: [md.sequelize.literal(`(fecha_inicio >= '${body.year}-${body.month}-1' AND fecha_inicio <= '${body.year}-${body.month}-${days_in_month}') OR (fecha_final >= '${body.year}-${body.month}-1' AND fecha_final <= '${body.year}-${body.month}-${days_in_month}')`)],
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
            query.estado_pauta = body.estado_pauta == 'abierta' ? true : body.estado_pauta == 'cerrada' ? false : '';
        }

        if (body.status_pago && body.status_pago != undefined) {
            query.pagado = body.status_pago == 'pagado' ? true : body.status_pago == 'impago' ? false : '';
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
                    id_objetivo: md.sequelize.fn('', md.sequelize.col('reportes.id_objetivo'))
                },
                required: false,
            }
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
                includeCampana.include = [{
                    model: md.categorias,
                    as: 'categorias',
                    attributes: ['id', 'nombre'],
                    required: true,
                }];

                // Si hay filtro por empresa, añade Empresa al JOIN
                if (id_empresa) {
                    includeCampana.include[0].include = [{
                        model: md.empresas,
                        as: 'empresas',
                        attributes: ['id', 'nombre'],
                        required: true,
                        where: { id: id_empresa }, // Filtro obligatorio si se envía
                    }];
                }
            }

            includes.push(includeCampana);
        }
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
            attributes: ['id', 'fecha_inicio', 'fecha_final', 'nombre', 'id_campana', 'id_objetivo', 'objetivo_proyectado', 'id_usuario',
                [md.sequelize.literal(`
                    (SELECT SUM(valor) 
                     FROM reporte_dia 
                     WHERE reporte_dia.id_reporte = reportes.id and reporte_dia.id_objetivo = reportes.id_objetivo)
                  `), 'sum_total']
            ],
            order: [
                [{ model: md.reporte_dia, as: 'reporte_dia' }, 'anio', 'ASC'],
                [{ model: md.reporte_dia, as: 'reporte_dia' }, 'mes', 'ASC'],
                [{ model: md.reporte_dia, as: 'reporte_dia' }, 'dia', 'ASC']
            ],
            raw: false // Para obtener instancias de Sequelize (mejor para relaciones)
        });

        res.status(200).send({
            totalPages: totalPages,
            items: reportes,
        });
    } catch (error) {
        console.log('error', error)
        res.status(500).send({ message: "Ocurrió un error al buscar los reportes. " + error });
    }
}

module.exports = {
    getById,
    getAllByCampaign,
    getAllByUser,
    saveUpdate,
    updateAllDaysByReportAndObjetivo,
    getDaysByReportId,
    updateReporteDia,
    reporteDiasReview,
};