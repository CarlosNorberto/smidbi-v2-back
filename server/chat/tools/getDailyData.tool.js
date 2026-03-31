const md = require('../../models');
const { Op } = require('sequelize');

/**
 * Obtiene los datos diarios de una campaña específica, agrupados por objetivo.
 * Se pueden filtrar por rango de fechas y por objetivo específico. * 
 * Ejemplo de preguntas:
 * - "¿Cuáles son los datos diarios de la campaña X para hoy?"
 * - "¿Cuántos clicks tuvo la campaña Y esta semana?"
 * @param {number} campaign_id - ID de la campaña
 * @param {string} fecha_inicio - Fecha de inicio del rango (formato 'YYYY-MM-DD')
 * @param {string} fecha_fin - Fecha de fin del rango (formato 'YYYY-MM-DD')
 * @param {number|null} objetivo - ID del objetivo específico para filtrar (opcional)
 * @returns {Object} Un objeto con los datos diarios agrupados por objetivo, incluyendo total, promedio diario, mejor día y peor día para cada objetivo.
 * @throws {Error} Si no se encuentra ningún reporte activo para la campaña especificada o si ocurre un error al obtener los datos diarios.
 */
const getDailyData = async ({ campaign_id, start_date, end_date }) => {
    try {

        // Primero traer el reporte con su objetivo principal
        const reporte = await md.reportes.scope(['withObjectives']).findOne({
            where: {
                id: campaign_id,
                activo: true
            },
            include: [
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
                },
            ]
        });

        if (!reporte) {
            return { error: 'No se encontró la campaña especificada' };
        }

        const id_objetivo = reporte.objetivo?.id;

        if (!id_objetivo) {
            return { error: 'La campaña no tiene un objetivo definido' };
        }

        const whereReporteDia = {
            id_objetivo
        };

        if (start_date && end_date) {
            whereReporteDia[Op.or] = buildDateRangeCondition(start_date, end_date);
        }

        const dias = await md.reporte_dia.findAll({
            where: {
                id_reporte: campaign_id,
                ...whereReporteDia
            },
            attributes: ['valor', 'dia', 'mes', 'anio'],
            order: [['anio', 'ASC'], ['mes', 'ASC'], ['dia', 'ASC']]
        });

        if (!dias.length) {
            return {
                campaign_id,
                campaign_name: reporte.nombre,
                objetivo: reporte.objetivo.objetivo,
                period: { start_date, end_date },
                data: [],
                metrics: null,                
            };
        }

        // Calcular métricas
        const valores = dias.map(d => d.valor);
        const total = valores.reduce((a, b) => a + b, 0);
        const mejorDia = dias.reduce((a, b) => a.valor > b.valor ? a : b);
        const peorDia = dias.reduce((a, b) => a.valor < b.valor ? a : b);

        return {
            campaign_id,
            campaign_name: reporte.nombre,
            objetivo: reporte.objetivo.objetivo,
            period: { start_date, end_date },
            data: dias.map(d => ({
                day: d.dia,
                month: d.mes,
                year: d.anio,
                value: d.valor
            })),
            metrics: {
                total,
                daily_average: Math.round(total / dias.length),
                best_day: {
                    day: mejorDia.dia, month: mejorDia.mes,
                    year: mejorDia.anio, value: mejorDia.valor
                },
                worst_day: {
                    day: peorDia.dia, month: peorDia.mes,
                    year: peorDia.anio, value: peorDia.valor
                },
                days_with_data: dias.length
            },
            link_to_report: `https://v2.smidbi.site/admin/${reporte.campana.categoria.empresa.id}/${reporte.campana.categoria.id}/${reporte.campana.id}/${reporte.id}/report/edit`
        };

    } catch (error) {
        console.error('Error in getDailyData:', error);
        throw new Error('Error fetching daily data: ' + error.message);
    }
};

const buildDateRangeCondition = (start_date, end_date) => {
    const conditions = [];

    const start = new Date(start_date + 'T00:00:00');
    const end = new Date(end_date + 'T00:00:00');

    const current = new Date(start);

    while (current <= end) {
        conditions.push({
            dia: current.getDate(),
            mes: current.getMonth() + 1,
            anio: current.getFullYear()
        });
        current.setDate(current.getDate() + 1);
    }

    return conditions;
}

module.exports = getDailyData;

