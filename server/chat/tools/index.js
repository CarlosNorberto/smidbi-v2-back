const toolDefinitions = [
    {
        type: 'function',
        function: {
            name: 'get_campaign_status',
            description: 'Obtiene el estado actual de una campaña: KPIs, presupuesto ejecutado y avance general.',
            parameters: {
                type: 'object',
                properties: {
                    campaign_id: { type: 'number', description: 'ID de la campaña' }
                },
                required: ['campaign_id']
            }
        }
    },
    {
        type: 'function',
        function: {
            name: 'get_daily_data',
            description: 'Obtiene los valores diarios de una campaña en un rango de fechas.',
            parameters: {
                type: 'object',
                properties: {
                    campana_id: { type: "number" },
                    fecha_inicio: { type: "string", description: "formato YYYY-MM-DD" },
                    fecha_fin: { type: "string", description: "formato YYYY-MM-DD" }
                },
                required: ["campana_id", "fecha_inicio", "fecha_fin"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_projection",
            description: "Proyecta si la campaña llegará a su meta al ritmo actual",
            parameters: {
                type: "object",
                properties: {
                    campana_id: { type: "number" }
                },
                required: ["campana_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_all_campaigns",
            description: "Trae el resumen de todas las campañas activas de un cliente",
            parameters: {
                type: "object",
                properties: {
                    cliente_id: { type: "number" }
                },
                required: ["cliente_id"]
            }
        }
    },
    {
        type: "function",
        function: {
            name: "get_low_performance_campaigns",
            description: "Devuelve campañas que están por debajo del KPI esperado según los días transcurridos",
            parameters: {
                type: "object",
                properties: {},
                required: []
            }
        }
    }
];

module.exports = toolDefinitions;