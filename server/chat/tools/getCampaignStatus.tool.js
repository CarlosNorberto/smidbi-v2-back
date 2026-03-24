const md = require('../../models');

const getCampaignStatus = async ({ campaign_id }) => {
    try {
        const campaign = await md.reportes.scope(['withObjectives', 'withPlatform']).findOne({
            where: {
                id: campaign_id,
                activo: true
            },
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
                    [md.Sequelize.literal(`"reportes"."fecha_fin"::date - CURRENT_DATE + 1`), 'dias_restantes'],
                    // Actual
                    [md.sequelize.literal(`
                        (SELECT SUM(valor) 
                            FROM reporte_dia 
                            WHERE reporte_dia.id_reporte = reportes.id and reporte_dia.id_objetivo = reportes.id_objetivo)
                        `), 'sum_total']
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
            ],
        });

        if (!campaign) {
            return { error: 'Campaña no encontrada' };
        }
        return {
            id: campaign.id,
            nombre: campaign.nombre,
            presupuesto: campaign.presupuesto,
            objetivo_proyectado: campaign.objetivo_proyectado,
            sesiones: campaign.sesiones,
            conversiones: campaign.conversiones,
            cp: campaign.cp,
            // ejecutado: campaign.ejecutado,
            porc_plataforma: campaign.porc_plataforma,
            fecha_inicio: campaign.fecha_ini,
            fecha_final: campaign.fecha_fin,
            ctr: campaign.ctr,
            frecuencia: campaign.frecuencia,
            total_facturado: campaign.get('total_facturado'),
            en_plataforma: campaign.get('en_plataforma'),
            monto_por_dia: campaign.get('monto_por_dia'),
            dias_restantes: campaign.get('dias_restantes'),
            kpi: {
                nombre: campaign.objetivo ? campaign.objetivo.objetivo : 'N/A',
                meta: campaign.objetivo_proyectado,
                actual: campaign.get('sum_total') || 0,
                porcentaje: (campaign.get('sum_total') / campaign.objetivo_proyectado * 100).toFixed(2) || 0
            },
            plataforma: campaign.plataforma ? campaign.plataforma.plataforma : 'N/A'
        }
    } catch (error) {
        console.error('Error al obtener el estado de la campaña:', error);
        return { error: 'Error al obtener el estado de la campaña' };
    }
};

module.exports = getCampaignStatus;