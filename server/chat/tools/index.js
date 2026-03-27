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
    // {
    //     type: "function",
    //     function: {
    //         name: "get_projection",
    //         description: "Proyecta si la campaña llegará a su meta al ritmo actual",
    //         parameters: {
    //             type: "object",
    //             properties: {
    //                 campana_id: { type: "number" }
    //             },
    //             required: ["campana_id"]
    //         }
    //     }
    // },
    // {
    //     type: "function",
    //     function: {
    //         name: "get_all_campaigns",
    //         description: "Trae el resumen de todas las campañas activas de un cliente",
    //         parameters: {
    //             type: "object",
    //             properties: {
    //                 cliente_id: { type: "number" }
    //             },
    //             required: ["cliente_id"]
    //         }
    //     }
    // },
    // {
    //     type: "function",
    //     function: {
    //         name: "get_low_performance_campaigns",
    //         description: "Devuelve campañas que están por debajo del KPI esperado según los días transcurridos",
    //         parameters: {
    //             type: "object",
    //             properties: {},
    //             required: []
    //         }
    //     }
    // }
];

module.exports = toolDefinitions;