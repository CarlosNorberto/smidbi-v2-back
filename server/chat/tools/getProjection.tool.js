const md = require('../../models');
const { Op } = require('sequelize');

const getProjection = async ({campaign_id}) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // ── 1. Traer el reporte con su objetivo ──
        const reporte = await md.reportes.findOne({
            where: { id: campaign_id, activo: true },
            attributes: [
                'id', 'nombre', 'presupuesto', 'objetivo_proyectado',
                'ejecutado', 'fecha_ini', 'fecha_fin', 'ctr', 'cp'
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
                    attributes: ['id', 'nombre'],
                    include: [
                        {
                            model: md.categorias,
                            as: 'categoria',
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
                }
            ]
        });

        if (!reporte) return { error: 'Campaña no encontrada' };

        // ── 2. Traer suma total de valores diarios ──
        // Excluir el día actual porque siempre es 0
        const sumResult = await md.reporte_dia.findOne({
            where: {
                id_reporte: campaign_id,
                id_objetivo: reporte.objetivo.id,
                // Excluir día actual
                [Op.not]: {
                    dia: today.getDate(),
                    mes: today.getMonth() + 1,
                    anio: today.getFullYear()
                }
            },
            attributes: [
                [md.sequelize.fn('SUM', md.sequelize.col('valor')), 'total'],
                [md.sequelize.fn('COUNT', md.sequelize.col('id')), 'days_with_data'],
                [md.sequelize.fn('AVG', md.sequelize.col('valor')), 'daily_average']
            ],
            raw: true
        });

        // ── 3. Calcular fechas ──
        const fechaIni = new Date(reporte.fecha_ini + 'T00:00:00');
        const fechaFin = new Date(reporte.fecha_fin + 'T00:00:00');

        const totalDays = Math.ceil((fechaFin - fechaIni) / (1000 * 60 * 60 * 24)) + 1;
        const daysElapsed = Math.ceil((today - fechaIni) / (1000 * 60 * 60 * 24));
        const daysRemaining = Math.ceil((fechaFin - today) / (1000 * 60 * 60 * 24)) + 1;

        // ── 4. Calcular proyección ──
        const totalActual = parseFloat(sumResult?.total) || 0;
        const daysWithData = parseInt(sumResult?.days_with_data) || 0;
        const dailyAverage = daysWithData > 0
            ? totalActual / daysWithData
            : 0;

        const projectedTotal = totalActual + (dailyAverage * daysRemaining);
        const goal = parseFloat(reporte.objetivo_proyectado) || 0;

        // ── 5. Calcular porcentajes ──
        const goalProgress = goal > 0 ? (totalActual / goal * 100).toFixed(1) : 0;
        const timeProgress = totalDays > 0 ? (daysElapsed / totalDays * 100).toFixed(1) : 0;
        const budgetProgress = reporte.presupuesto > 0
            ? (reporte.ejecutado / reporte.presupuesto * 100).toFixed(1)
            : 0;

        // ── 6. Determinar probabilidad ──
        // Si el avance del KPI supera el avance del tiempo → bien
        const kpiVsTime = parseFloat(goalProgress) - parseFloat(timeProgress);
        const probability = kpiVsTime >= 5 ? 'alta' :
            kpiVsTime >= -10 ? 'media' : 'baja';

        // ── 7. Ritmo necesario para llegar a la meta ──
        const neededDailyRate = daysRemaining > 0
            ? Math.ceil((goal - totalActual) / daysRemaining)
            : 0;

        return {
            campaign_id,
            campaign_name: reporte.nombre,
            objetivo: reporte.objetivo.objetivo,
            period: {
                start: reporte.fecha_ini,
                end: reporte.fecha_fin,
                total_days: totalDays,
                days_elapsed: daysElapsed,
                days_remaining: daysRemaining
            },
            kpi: {
                goal,
                current: totalActual,
                progress_percent: goalProgress,
                projected_total: Math.round(projectedTotal),
                daily_average: Math.round(dailyAverage),
                needed_daily_rate: neededDailyRate,
                days_with_data: daysWithData
            },
            budget: {
                total: parseFloat(reporte.presupuesto) || 0,
                executed: parseFloat(reporte.ejecutado) || 0,
                progress_percent: budgetProgress
            },
            time_progress_percent: timeProgress,
            probability,
            // Alerta si el presupuesto va más rápido que el KPI
            budget_alert: parseFloat(budgetProgress) > parseFloat(goalProgress) + 15,
            link_to_report: `https://v2.smidbi.site/admin/${reporte.campana.categoria.empresa.id}/${reporte.campana.categoria.id}/${reporte.campana.id}/${reporte.id}/report/edit`
        };

    } catch (error) {
        console.error('Error in getProjection:', error);
        throw new Error('Error fetching projection: ' + error.message);
    }
};

module.exports = getProjection