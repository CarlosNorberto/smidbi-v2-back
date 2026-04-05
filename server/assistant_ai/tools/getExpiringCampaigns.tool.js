const md = require('../../models');
const { Op } = require('sequelize');
const { getUserFilter } = require('../helps/helps');

const getExpiringCampaigns = async ({ days_ahead = 7, include_inactive = false, currentUser }) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const limitDate = new Date(today);
        limitDate.setDate(limitDate.getDate() + days_ahead);

        const reportes = await md.reportes.findAll({
            where: {
                ...(include_inactive ? {} : { activo: true }),
                ...getUserFilter(currentUser),
                fecha_ini: { [Op.lte]: today },
                fecha_fin: {
                    [Op.gte]: today,
                    [Op.lte]: limitDate
                }
            },
            attributes: [
                'id', 'nombre', 'presupuesto',
                'objetivo_proyectado', 'ejecutado',
                'fecha_ini', 'fecha_fin'
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
                                    where: { activo: true },
                                    attributes: ['id', 'nombre']
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [['fecha_fin', 'ASC']]
        });

        if (!reportes.length) {
            return {
                total: 0,
                days_ahead,
                by_company: [],
                message: `No hay campañas que venzan en los próximos ${days_ahead} días`
            };
        }

        // Agrupar por empresa
        const porEmpresa = {};
        reportes.forEach(r => {
            const empresa = r.campana.categoria.empresa.nombre;
            const empresa_id = r.campana.categoria.empresa.id;
            const fechaFin = new Date(r.fecha_fin + 'T00:00:00');
            const daysRemaining = Math.ceil((fechaFin - today) / (1000 * 60 * 60 * 24)) + 1;

            if (!porEmpresa[empresa]) {
                porEmpresa[empresa] = {
                    company: empresa,
                    company_id: empresa_id,
                    total: 0,
                    campaigns: []
                };
            }

            porEmpresa[empresa].total++;
            porEmpresa[empresa].campaigns.push({
                campaign_id: r.id,
                campaign_name: r.nombre,
                objetivo: r.objetivo?.objetivo,
                presupuesto: parseFloat(r.presupuesto) || 0,
                ejecutado: parseFloat(r.ejecutado) || 0,
                meta: parseFloat(r.objetivo_proyectado) || 0,
                fecha_fin: r.fecha_fin,
                status: daysRemaining <= 1 ? 'vence hoy' :
                    `vence en ${daysRemaining} días`,
                link_to_report: `https://smidbi.site/admin/${r.campana.categoria.empresa.id}/${r.campana.categoria.id}/${r.campana.id}/${r.id}/report/edit`
            });
        });

        return {
            total: reportes.length,
            days_ahead,
            by_company: Object.values(porEmpresa)
                .sort((a, b) => b.total - a.total) // empresas con más campañas primero
        };

    } catch (error) {
        console.error('Error in getExpiringCampaigns:', error);
        throw new Error('Error fetching expiring campaigns: ' + error.message);
    }
};

module.exports = getExpiringCampaigns;