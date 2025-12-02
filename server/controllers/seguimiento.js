const md = require('../models');

const loadTracking = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const { user_ids, companie_ids, platform_id, month, year } = req.body;
        let general_where = {
            activo: true
        };
        let client_where = {};
        if (user_ids) {
            client_where.id_usuario = {
                [md.Sequelize.Op.in]: user_ids
            };
        }
        if (platform_id) {
            general_where.id_plataforma = platform_id;
        }
        if (month && year) {
            general_where.fecha_ini = { [md.Sequelize.Op.gte]: new Date(year, month - 1, 1) };
            general_where.fecha_fin = { [md.Sequelize.Op.lte]: new Date(year, month, 0) };
        }
        if (companie_ids && companie_ids.length > 0) {
            if (typeof companie_ids === 'string')
                client_where.id_empresa = {
                    [md.Sequelize.Op.in]: companie_ids.split(',')
                };
            else
                client_where.id_empresa = {
                    [md.Sequelize.Op.in]: companie_ids
                };
        }

        // amount by day
        // const amount_by_day = md.Sequelize.literal(`(


        const reports = await md.reportes.findAndCountAll({
            where: general_where,
            attributes: {
                include: [
                    // suma total facturado por reporte
                    [md.Sequelize.literal(`(SELECT SUM("presupuesto") FROM "reportes" AS "r" WHERE "r"."id_campana" = "reportes"."id_campana")`), 'total_facturado'],
                    // porcentaje_plataforma * presupuesto
                    [md.Sequelize.literal(`"reportes"."porc_plataforma" * "reportes"."presupuesto"`), 'en_plataforma'],
                    // Monto por dia
                    [md.Sequelize.literal(`
                        ROUND(
                            CASE 
                                WHEN ("reportes"."fecha_fin"::date - CURRENT_DATE::date + 1) > 0 
                                THEN (("reportes"."porc_plataforma" * "reportes"."presupuesto") - COALESCE("reportes"."ejecutado", 0)) / ("reportes"."fecha_fin"::date - CURRENT_DATE::date + 1)
                                ELSE 0
                            END
                        ,2)
                    `), 'monto_por_dia'],
                    // Dias restantes
                    [md.Sequelize.literal(`"reportes"."fecha_fin"::date - CURRENT_DATE + 1`), 'dias_restantes']
                ],
                exclude: [
                    'usuario_creacion',
                    'usuario_modificacion',
                    'usuario_eliminacion',
                    'fecha_creacion',
                    'fecha_modificacion',
                    'fecha_eliminacion',
                    'fecha_inicio',
                    'fecha_final',
                    'link', 'link_w', 'link_h',
                    'id_campaign',
                    'id_campana',
                    'id_plataforma',
                    'id_objetivo'
                ]
            },
            include: [
                {
                    model: md.campanas,
                    as: 'campana',
                    required: true,
                    attributes: ['id', 'nombre'],
                    include: [
                        {
                            model: md.categorias,
                            as: 'categoria',
                            required: true,
                            attributes: ['id', 'nombre'],
                            where: client_where,
                            include: [
                                {
                                    model: md.empresas,
                                    as: 'empresa',
                                    attributes: ['id', 'nombre']
                                }
                            ]
                        }
                    ]
                },
                {
                    model: md.plataformas,
                    as: 'plataforma',
                    attributes: ['id', 'plataforma']
                },
                {
                    model: md.objetivos,
                    as: 'objetivo',
                    attributes: ['id', 'objetivo']
                }
            ],
            limit,
            offset: (page - 1) * limit,
            order: [
                // order by company (empresa)
                [{ model: md.campanas, as: 'campana' }, { model: md.categorias, as: 'categoria' }, { model: md.empresas, as: 'empresa' }, 'nombre', 'ASC'],
                // order by category (categoria)
                [{ model: md.campanas, as: 'campana' }, { model: md.categorias, as: 'categoria' }, 'nombre', 'ASC'],
                // order by campaign (campaña)
                [{ model: md.campanas, as: 'campana' }, 'nombre', 'ASC']
            ]
        });
        res.status(200).json(reports);
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' + error.message });
    }
};

module.exports = {
    loadTracking,
};