const md = require('../../models');
const { Op } = require('sequelize');

const getLowPerformance = async () => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Traer todas las campañas activas con fecha vigente
        const reportes = await md.reportes.findAll({
            where: {
                activo: true,
                seguimiento_activo: true,
                fecha_ini: { [Op.lte]: today },
                fecha_fin: { [Op.gte]: today }
            },
            attributes: [
                'id', 'nombre', 'objetivo_proyectado',
                'presupuesto', 'ejecutado',
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
            ]
        });

        if (!reportes.length) {
            return { campaigns: [], message: 'No hay campañas activas en este momento' };
        }

        // Para cada reporte traer el total acumulado de reporte_dia
        const results = await Promise.all(reportes.map(async (reporte) => {
            const sumResult = await md.reporte_dia.findOne({
                where: {
                    id_reporte: reporte.id,
                    id_objetivo: reporte.objetivo?.id,
                    // Excluir día actual (siempre es 0)
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
                    gap            // negativo = va mal, positivo = va bien
                },
                days_remaining: daysRemaining,
                budget: {
                    total: parseFloat(reporte.presupuesto) || 0,
                    executed: parseFloat(reporte.ejecutado) || 0
                },
                link_to_report: `https://v2.smidbi.site/admin/${reporte.campana.categoria.empresa.id}/${reporte.campana.categoria.id}/${reporte.campana.id}/${reporte.id}/report/edit`
            };
        }));

        // Filtrar solo las que van mal: KPI más de 10% por debajo del tiempo
        const lowPerformance = results
            .filter(r => r.kpi.gap < -10)
            .sort((a, b) => a.kpi.gap - b.kpi.gap); // peores primero

        return {
            total_active_campaigns: reportes.length,
            total_low_performance: lowPerformance.length,
            threshold_used: 'KPI más de 10% por debajo del tiempo transcurrido',
            campaigns: lowPerformance
        };

    } catch (error) {
        console.error('Error in getLowPerformance:', error);
        throw new Error('Error fetching low performance campaigns: ' + error.message);
    }
};

module.exports = getLowPerformance;