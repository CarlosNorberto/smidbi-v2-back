const md = require('../../models');
const { Op } = require('sequelize');

const getActiveCampaigns = async ({ company_id }) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const reportes = await md.reportes.findAll({
            where: {
                activo: true,
                seguimiento_activo: true,
                fecha_ini: { [Op.lte]: today },
                fecha_fin: { [Op.gte]: today }
            },
            attributes: [
                'id', 'nombre', 'presupuesto',
                'objetivo_proyectado', 'fecha_ini', 'fecha_fin'
            ],
            include: [
                {
                    model: md.objetivos,
                    as: 'objetivo',
                    attributes: ['id', 'objetivo']
                },
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
                                    required: true,
                                    where: { id: company_id, activo: true },
                                    attributes: ['id', 'nombre']
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [['fecha_fin', 'ASC']] // las que vencen antes, primero
        });

        if (!reportes.length) {
            return {
                company_id,
                total: 0,
                campaigns: [],
                message: 'No hay campañas activas para este cliente'
            };
        }

        const companyName = reportes[0].campana.categoria.empresa.nombre;

        const resp = {
            company_id,
            company_name: companyName,
            total: reportes.length,
            campaigns: reportes.map(r => {
                const fechaFin = new Date(r.fecha_fin + 'T00:00:00');
                const daysRemaining = Math.ceil((fechaFin - today) / (1000 * 60 * 60 * 24)) + 1;

                if (daysRemaining < 0) return null;

                return {
                    campaign_id: r.id,
                    campaign_name: r.nombre,
                    objetivo: r.objetivo?.objetivo,
                    presupuesto: parseFloat(r.presupuesto) || 0,
                    meta: parseFloat(r.objetivo_proyectado) || 0,
                    fecha_ini: r.fecha_ini,
                    fecha_fin: r.fecha_fin,
                    days_remaining: daysRemaining,
                    link_to_report: `https://smidbi.site/admin/${r.campana.categoria.empresa.id}/${r.campana.categoria.id}/${r.campana.id}/${r.id}/report/edit`
                };
            })
        };
        return resp;

    } catch (error) {
        console.error('Error in getActiveCampaigns:', error);
        throw new Error('Error fetching active campaigns: ' + error.message);
    }
};

module.exports = getActiveCampaigns;