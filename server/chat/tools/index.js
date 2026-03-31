const toolDefinitions = [
    {
        type: 'function',
        function: {
            name: 'get_campaign_status',
            description: 'Obtiene el estado actual de una campaña: KPIs, presupuesto ejecutado y avance general.',
            parameters: {
                type: 'object',
                properties: {
                    campana_id: { type: 'number', description: 'ID de la campaña' }
                },
                required: ['campana_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_daily_data',
            description: 'Obtiene los datos diarios de una campaña específica, agrupados por objetivo. Se pueden filtrar por rango de fechas y por objetivo específico.',
            parameters: {
                type: 'object',
                properties: {
                    campana_id: { type: "number" },
                    fecha_inicio: { type: "string", description: "formato YYYY-MM-DD" },
                    fecha_fin: { type: "string", description: "formato YYYY-MM-DD" },
                    objetivo: { type: "number", description: "ID del objetivo específico para filtrar (opcional)" }
                },
                required: ["campana_id"]
            }
        }
    },
];

module.exports = toolDefinitions;