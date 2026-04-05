// tools/getMyCampaigns.tool.js
const { Op } = require('sequelize');
const md = require('../../models');
const { getUserFilter } = require('../helps/helps');

const getMyCampaigns = async ({ currentUser }) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const reportes = await md.reportes.findAll({
            where: {
                activo: true,
                seguimiento_activo: true,
                fecha_ini: { [Op.lte]: today },
                fecha_fin: { [Op.gte]: today },
                ...getUserFilter(currentUser)
            },
            attributes: [
                'id', 'nombre', 'presupuesto', 'objetivo_proyectado',
                'ejecutado', 'fecha_ini', 'fecha_fin'
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
                campaigns: [],
                message: currentUser.role.rol === 'admin'
                    ? 'No hay campañas activas en el sistema en este momento'
                    : 'No tienes campañas activas asignadas en este momento'
            };
        }

        // ── Calcular métricas por campaña ──
        const campaigns = await Promise.all(reportes.map(async (reporte) => {
            const sumResult = await md.reporte_dia.findOne({
                where: {
                    id_reporte: reporte.id,
                    id_objetivo: reporte.objetivo?.id,
                    [Op.not]: {
                        dia: today.getDate(),
                        mes: today.getMonth() + 1,
                        anio: today.getFullYear()
                    }
                },
                attributes: [
                    [md.sequelize.fn('SUM', md.sequelize.col('valor')), 'total']
                ],
                raw: true
            });

            const fechaIni = new Date(reporte.fecha_ini + 'T00:00:00');
            const fechaFin = new Date(reporte.fecha_fin + 'T00:00:00');
            const totalDays = Math.ceil((fechaFin - fechaIni) / (1000 * 60 * 60 * 24)) + 1;
            const daysElapsed = Math.ceil((today - fechaIni) / (1000 * 60 * 60 * 24));
            const daysRemaining = Math.ceil((fechaFin - today) / (1000 * 60 * 60 * 24)) + 1;

            const goal = parseFloat(reporte.objetivo_proyectado) || 0;
            const current = parseFloat(sumResult?.total) || 0;
            const timeProgress = totalDays > 0
                ? parseFloat((daysElapsed / totalDays * 100).toFixed(1))
                : 0;
            const kpiProgress = goal > 0
                ? parseFloat((current / goal * 100).toFixed(1))
                : 0;
            const gap = kpiProgress - timeProgress;
            const status = gap >= 0 ? 'on_track' : gap >= -10 ? 'at_risk' : 'behind';

            return {
                campaign_id: reporte.id,
                campaign_name: reporte.nombre,
                company: reporte.campana?.categoria?.empresa?.nombre,
                objetivo: reporte.objetivo?.objetivo,
                kpi: {
                    goal,
                    current,
                    kpi_progress: kpiProgress,
                    time_progress: timeProgress,
                    gap,
                    status
                },
                budget: {
                    total: parseFloat(reporte.presupuesto) || 0,
                    executed: parseFloat(reporte.ejecutado) || 0
                },
                status: daysRemaining <= 1 ? 'vence hoy' : `vence en ${daysRemaining} días`,
                link_to_report: `https://smidbi.site/admin/${reporte.campana.categoria.empresa.id}/${reporte.campana.categoria.id}/${reporte.campana.id}/${reporte.id}/report/edit`
            };
        }));

        // ── Totales generales ──
        const totalBudget = campaigns.reduce((s, c) => s + c.budget.total, 0);
        const totalExecuted = campaigns.reduce((s, c) => s + c.budget.executed, 0);
        const totalGoal = campaigns.reduce((s, c) => s + c.kpi.goal, 0);
        const totalCurrent = campaigns.reduce((s, c) => s + c.kpi.current, 0);

        const onTrack = campaigns.filter(c => c.kpi.status === 'on_track').length;
        const atRisk = campaigns.filter(c => c.kpi.status === 'at_risk').length;
        const behind = campaigns.filter(c => c.kpi.status === 'behind').length;

        return {
            context: currentUser.role.rol === 'admin'
                ? 'Todas las campañas activas del sistema'
                : `Campañas asignadas a ${currentUser.nombre}`,
            summary: {
                total_campaigns: campaigns.length,
                on_track: onTrack,
                at_risk: atRisk,
                behind: behind,
                budget: {
                    total: parseFloat(totalBudget.toFixed(2)),
                    executed: parseFloat(totalExecuted.toFixed(2)),
                    progress_percent: totalBudget > 0
                        ? parseFloat((totalExecuted / totalBudget * 100).toFixed(1))
                        : 0
                },
                kpi: {
                    total_goal: totalGoal,
                    total_current: totalCurrent,
                    progress_percent: totalGoal > 0
                        ? parseFloat((totalCurrent / totalGoal * 100).toFixed(1))
                        : 0
                }
            },
            campaigns
        };

    } catch (error) {
        console.error('Error in getMyCampaigns:', error);
        throw new Error('Error fetching my campaigns: ' + error.message);
    }
};

module.exports = getMyCampaigns;