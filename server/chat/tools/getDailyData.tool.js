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
const getDailyData = async (campaign_id, fecha_inicio, fecha_fin, objetivo = null) => {
    try {
        const whereReporteDia = {};

        // Filtrar por rango de fechas si se especifica
        if (fecha_inicio && fecha_fin) {
            // Convertimos a condiciones por dia/mes/anio
            // porque tu tabla no tiene columna fecha directa
            whereReporteDia[Op.or] = buildDateRangeCondition(fecha_inicio, fecha_fin);
        }

        // Filtrar por objetivo específico si se especifica
        if (objetivo) {
            whereReporteDia['$reporte_dia.id_objetivo$'] = objetivo;
        }

        const reporte = await md.reportes.scope(['withObjectives']).findOne({
            where: {
                id: campaign_id,
                activo: true
            },
            include: [
                {
                    model: models.reporte_dia,
                    as: 'reporte_dia',
                    where: Object.keys(whereReporteDia).length ? whereReporteDia : undefined,
                    required: false,
                    attributes: ['id', 'valor', 'dia', 'mes', 'anio', 'id_objetivo'],
                    include: [
                        {
                            model: models.objetivos,
                            as: 'objetivo',
                            attributes: ['id', 'objetivo']
                        }
                    ]
                }
            ]
        });

        if (!reporte) {
            return { error: 'No se encontró la campaña especificada' };
        }

        // Agrupar por objetivo
        const porObjetivo = {};
        reporte.reporte_dia.forEach(dia => {
            const nombreObjetivo = dia.objetivo?.objetivo || 'Sin objetivo';
            if (!porObjetivo[nombreObjetivo]) {
                porObjetivo[nombreObjetivo] = {
                    objetivo: nombreObjetivo,
                    datos: [],
                    total: 0,
                    promedio_diario: 0,
                    mejor_dia: null,
                    peor_dia: null
                };
            }
            porObjetivo[nombreObjetivo].datos.push({
                dia: dia.dia,
                mes: dia.mes,
                anio: dia.anio,
                valor: dia.valor
            });
        });

        // Calcular métricas por objetivo
        Object.values(porObjetivo).forEach(obj => {
            const valores = obj.datos.map(d => d.valor);
            obj.total = valores.reduce((a, b) => a + b, 0);
            obj.promedio_diario = Math.round(obj.total / valores.length);
            obj.mejor_dia = obj.datos.reduce((a, b) => a.valor > b.valor ? a : b);
            obj.peor_dia = obj.datos.reduce((a, b) => a.valor < b.valor ? a : b);
        });

        return {
            campana_id: campaign_id,
            campana_nombre: reporte.nombre,
            periodo: { fecha_inicio, fecha_fin },
            objetivos: Object.values(porObjetivo)
        };
    } catch (error) {
        console.error('Error al obtener los datos diarios:', error);
        throw new Error('Error al obtener los datos diarios: ' + error.message);
    }
};

module.exports = getDailyData;

