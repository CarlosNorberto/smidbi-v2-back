const md = require('../models');
const { DateTime } = require('luxon');
const { isBefore, addDays, parse } = require('date-fns');
const { getUploadUrl, getUploadPath } = require('../helps');
const fs = require('fs');

// ************** REPORTS

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        let { attributes } = req.query;
        attributes = attributes ? attributes.split(',') : null;
        const reporte = await md.reportes.findOne({
            where: {
                id: id,
            },
            attributes: attributes ? attributes : ['id', 'nombre', 'descripcion']
        });
        if (!reporte) {
            return res.status(404).json({ message: 'Reporte no encontrado' });
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

const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.params;
        const offset = (page - 1) * limit;
        let where = {};
        if (req.body) {
            const { name, own, campaign_id, category_id, company_id, year, month } = req.body;
            if (own === true || own === 'true') {
                where.id_usuario = req.user.id;
            }
            if (name) {
                where.nombre = {
                    [md.Sequelize.Op.iLike]: `%${name}%`
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
                        md.Sequelize.where(md.Sequelize.fn('EXTRACT', md.Sequelize.literal('YEAR FROM "fecha_ini"')), year),
                        md.Sequelize.where(md.Sequelize.fn('EXTRACT', md.Sequelize.literal('MONTH FROM "fecha_ini"')), month)
                    ]
                };
            }
        }
        const reportes = await md.reportes.findAndCountAll({
            where: where,            
            include: [{
                model: md.campanas,
                as: 'campana',
                attributes: ['id', 'nombre', 'id_categoria'],
                required: true,
                include: [{
                    model: md.categorias,
                    as: 'categoria',
                    attributes: ['id', 'nombre', 'id_empresa'],
                    required: true,
                    include: [{
                        model: md.empresas,
                        as: 'empresa',
                        attributes: ['id', 'nombre'],
                        required: true,
                    }]
                }]
            }],
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
        if (body.id) {
            report = await md.reportes.findByPk(body.id);
            if (report) {
                // Actualizar reporte existente
                await report.update(body);
            } else {
                return res.status(404).json({ message: 'No se encontró el reporte para actualizar' });
            }
        } else {
            if (body.fecha_ini) {
                const parsed = parse(body.fecha_ini, 'yyyy/MM/dd', new Date());
                body.fecha_ini = parsed;
                body.fecha_inicio = parsed;
            }
            if (body.fecha_fin) {
                const parsed = parse(body.fecha_fin, 'yyyy/MM/dd', new Date());
                body.fecha_fin = parsed;
                body.fecha_final = parsed;
            }
            body.usuario_creacion = req.user.id;
            report = await md.reportes.create(body);
        }
        await createDaysForReport(report.id, body.id_objetivo, body.fecha_ini, body.fecha_fin, req.user.id);
        res.status(200).json({ message: 'Reporte guardado correctamente', data: report });
    } catch (error) {
        res.status(500).json({ message: `Error al guardar el reporte ${error.message}` });
    }
};

const createDaysForReport = async (reportId, objetivoId, dateInit, dateEnd, user_id) => {
    try {
        dateInit = new Date(dateInit);
        dateEnd = new Date(dateEnd);
        let current = dateInit;
        // delete days
        await md.reporte_dia.destroy({
            where: {
                id_reporte: reportId,
                id_objetivo: objetivoId,
            }
        });
        while (isBefore(current, addDays(dateEnd, 1))) {
            const dia = current.getDate();
            const mes = current.getMonth() + 1;
            const anio = current.getFullYear();
            // Verificar si el día ya existe
            const existingDay = await md.reporte_dia.findOne({
                where: {
                    id_reporte: reportId,
                    id_objetivo: objetivoId,
                    dia: dia,
                    mes: mes,
                    anio: anio,
                    usuario_modificacion: user_id
                }
            });
            if (!existingDay) {
                // Crear nuevo día
                await md.reporte_dia.create({
                    id_reporte: reportId,
                    id_objetivo: objetivoId,
                    dia: dia,
                    mes: mes,
                    anio: anio,
                    valor: 0,
                    usuario_creacion: user_id
                });
            }
            // Avanzar al siguiente día
            current = addDays(current, 1);
        }
    } catch (error) {
        console.error(`Error al crear/actualizar días para el reporte ${reportId}: ${error.message}`);
    }
};

const enableDisableReport = async (req, res) => {
    try {
        const { id } = req.params;
        const report = await md.reportes.findByPk(id);
        if (!report) {
            return res.status(404).json({ message: 'No se encontró el reporte' });
        }
        report.activo = !report.activo;
        await report.save();
        res.status(200).json({ message: 'Reporte actualizado correctamente', data: report });
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar el reporte ${error.message}` });
    }
};

const deleteReport = async (req, res) => {
    try {
        const { id } = req.params;
        const report = await md.reportes.findByPk(id);
        if (!report) {
            return res.status(404).json({ message: 'No se encontró el reporte para eliminar' });
        }
        await report.destroy();
        res.status(200).json({ message: 'Reporte eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: `Error al eliminar el reporte ${error.message}` });
    }
};

// ************** SECONDARY OBJECTIVES

const getSecondaryObjectivesByReportId = async (req, res) => {
    try {
        const { report_id } = req.params;
        const objetivos_secundarios = await md.reporte_objetivos_secundarios.findAll({
            where: {
                id_reporte: report_id
            }
        });
        res.status(200).json(objetivos_secundarios);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los objetivos secundarios ${error.message}` });
    }
};

const saveUpdateSecondaryObjectives = async (req, res) => {
    try {
        const objetivos = req.body;
        const { report_id } = req.params;

        // Eliminar objetivos secundarios existentes
        await md.reporte_objetivos_secundarios.destroy({
            where: { id_reporte: report_id }
        });

        // Agregar nuevos objetivos secundarios
        for (const objetivo of objetivos) {
            await md.reporte_objetivos_secundarios.create({
                id_reporte: report_id,
                id_objetivo: objetivo.id_objetivo,
                valor: objetivo.valor
            });
        }

        res.status(200).json({ message: "Objetivos secundarios actualizados correctamente." });
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar los objetivos secundarios ${error.message}` });
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
        res.status(200).send({ message: "Valor actualizado correctamente en reporte_dia." });
    } catch (error) {
        res.status(500).send({ message: "Ocurrió un error al guardar el valor en reporte_dia. " + error });
    }
}

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
                id_reporte: parseInt(report_id)
            }
        });
        res.status(200).json(reporte_genero);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el género del reporte ${error.message}` });
    }
};

const saveUpdateGender = async (req, res) => {
    try {
        const body = req.body;
        const { report_id } = req.params;
        let reporte_genero = await md.interaccion_genero.findOne({
            where: {
                id_reporte: parseInt(report_id)
            }
        });
        if (reporte_genero) {
            await reporte_genero.update(body);
        } else {
            body.id_reporte = parseInt(report_id);
            body.usuario_creacion = req.user.id;
            reporte_genero = await md.interaccion_genero.create(body);
        }
        res.status(200).json({ message: "Género guardado correctamente.", data: reporte_genero });
    } catch (error) {
        res.status(500).json({ message: `Error al guardar/actualizar el género del reporte ${error.message}` });
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
                id_reporte: parseInt(report_id)
            },
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_modificacion', 'fecha_eliminacion'],
            }
        });
        res.status(200).json(reporte_dispositivos);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los dispositivos del reporte ${error.message}` });
    }
};

const saveUpdateDevices = async (req, res) => {
    try {
        const body = req.body;
        const { report_id } = req.params;
        let reporte_dispositivos = await md.interaccion_dispositivo.findOne({
            where: {
                id_reporte: parseInt(report_id)
            }
        });
        if (reporte_dispositivos) {
            await reporte_dispositivos.update(body);
        } else {
            body.id_reporte = parseInt(report_id);
            body.usuario_creacion = req.user.id;
            reporte_dispositivos = await md.interaccion_dispositivo.create(body);
        }
        res.status(200).json({ message: "Dispositivos guardados correctamente.", data: reporte_dispositivos });
    } catch (error) {
        res.status(500).json({ message: `Error al guardar/actualizar los dispositivos del reporte ${error.message}` });
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
                id_reporte: parseInt(report_id)
            },
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_modificacion', 'fecha_eliminacion'],
            }
        });
        res.status(200).json(reporte_horas);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las horas del reporte ${error.message}` });
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
                id_reporte: parseInt(report_id)
            },
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_modificacion', 'fecha_eliminacion'],
            }
        });
        if (reporte_horas) {
            await reporte_horas.update(body);
        } else {
            body.id_reporte = parseInt(report_id);
            body.usuario_creacion = req.user.id;
            reporte_horas = await md.interaccion_hora.create(body);
        }
        res.status(200).json({ message: "Horas guardadas correctamente.", data: reporte_horas });
    } catch (error) {
        res.status(500).json({ message: `Error al guardar/actualizar las horas del reporte ${error.message}` });
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
        let reporte_view_ads = await md.view_ads.findAll({
            where: {
                id_reporte: parseInt(report_id)
            },
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_modificacion', 'fecha_eliminacion'],
            }
        });
        // Agregar URL completa de la imagen a respuesta
        for (const ad of reporte_view_ads) {
            ad.dataValues.url = getUploadUrl(req, 'ads', ad.imagen);
        }

        res.status(200).json(reporte_view_ads);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los ADS asociados del reporte ${error.message}` });
    }
};

const saveUpdateViewAds = async (req, res) => {
    try {
        const body = req.body;
        const { report_id } = req.params;
        let reporte_view_ads = await md.interaccion_view_ads.findOne({
            where: {
                id_reporte: parseInt(report_id)
            }
        });
        if (reporte_view_ads) {
            await reporte_view_ads.update(body);
        } else {
            reporte_view_ads = await md.interaccion_view_ads.create(body);
        }
        res.status(200).json({ message: "Imagen de anuncio guardado correctamente.", data: reporte_view_ads });
    } catch (error) {
        res.status(500).json({ message: `Error al guardar/actualizar los anuncios vistos del reporte ${error.message}` });
    }
};

const uploadAdImage = async (req, res) => {
    try {
        const { report_id } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: "No se ha subido ninguna imagen." });
        }

        const imageName = file.filename;

        await md.view_ads.create({
            imagen: imageName,
            id_reporte: parseInt(report_id),
            usuario_creacion: req.user.id
        });

        res.status(200).json({ message: "Imagen de anuncio subida exitosamente." });
    } catch (error) {
        res.status(500).json({ message: `Error al subir la imagen del anuncio ${error.message}` });
    }
};

const deleteAdImage = async (req, res) => {
    try {
        const { imagen } = req.params;
        await md.view_ads.destroy({
            where: {
                imagen: imagen,
            }
        });
        const imagePath = getUploadPath('ads', imagen);
        try {
            fs.unlinkSync(imagePath);
        } catch (error) {
            console.error(`Error al eliminar la imagen del anuncio: ${error.message}`);
        }

        res.status(200).json({ message: "Imagen de anuncio eliminada exitosamente." });
    } catch (error) {
        res.status(500).json({ message: `Error al eliminar la imagen del anuncio ${error.message}` });
    }
};

// ************** REPORT MAP

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
            return res.status(400).json({ message: `Reporte no encontrado con ID ${report_id}` });
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
            return res.status(400).json({ message: `Mapa no encontrado con ID ${report.id_mapa}` });
        }
        const map_data = await model.findOne({
            where: {
                id_reporte: report_id,
            },
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_modificacion', 'fecha_eliminacion'],
            },
        });
        res.status(200).json(map_data);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el mapa ${error.message}` });
    }
};

// ************** REPORT REVIEW

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
        includes.push({
            model: md.campanas,
            as: 'campana',
            attributes: ['id', 'nombre', 'id_categoria'], // No devuelve datos de Campana (solo para JOIN)
            required: true, // INNER JOIN
            include: [{
                model: md.categorias,
                as: 'categoria',
                attributes: ['id', 'nombre'],
                required: false,
                include: [{
                    model: md.empresas,
                    as: 'empresa',
                    attributes: ['id', 'nombre'],
                    required: false,
                }]
            }]
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
            attributes: ['id', 'fecha_inicio', 'fecha_final', 'nombre', 'id_campana', 'id_objetivo', 'objetivo_proyectado', 'id_usuario', 'activo',
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
    getMapByReportID,
    reporteDiasReview,
};