const INTENTS = {
    campaign_status: {
        needs: ['company', 'campaign'],
        tool: 'get_campaign_status',
        description: 'Estado general de una campaña: presupuesto, KPIs, avance, CTR, fechas. Palabras clave: estado, cómo va, resumen, avance, rendimiento'
    },
    daily_data: {
        needs: ['company', 'campaign'],
        tool: 'get_daily_data',
        description: 'Valores numéricos por día de una campaña. Palabras clave: datos diarios, por día, clicks por día, impresiones por día, valores diarios, histórico diario'
    },
    projection: {
        needs: ['company', 'campaign'],
        tool: 'get_projection',
        description: 'Proyección de si la campaña alcanzará su objetivo'
    },
    full_report: {
        needs: ['company', 'campaign'],
        tool: 'generate_campaign_report',
        description: 'Informe completo de una campaña'
    },
    client_summary: {
        needs: ['company'],
        tool: 'get_client_summary',
        description: 'Resumen general de un cliente: campañas activas, presupuesto total, rendimiento general'
    },
    active_campaigns: {
        needs: ['company'],
        tool: 'get_active_campaigns',
        description: 'Lista de campañas activas de un cliente'
    },
    low_performance: {
        needs: [],
        tool: 'get_low_performance',
        description: 'Campañas que están por debajo de su KPI esperado'
    },
    expiring_campaigns: {
        needs: [],
        tool: 'get_expiring_campaigns',
        description: 'Campañas que están por expirar o vencer pronto'
    },
    user_list: {
        needs: [],
        tool: 'get_users',
        description: 'Lista de usuarios del sistema y sus roles'
    },
    global_budget: {
        needs: [],
        tool: 'get_global_budget',
        description: 'Resumen del presupuesto de todas las campañas activas'
    },
    unknown: {
        needs: [],
        tool: 'handle_unknown',
        description: 'Intent no reconocido o pregunta que no encaja en las otras categorías'
    }
};

function getNeeds(intent) {
    return INTENTS[intent]?.needs || [];
}

function getTool(intent) {
    return INTENTS[intent]?.tool || null;
}

function getIntentNames() {
    return Object.keys(INTENTS);
}

function getIntentDescriptions() {
    return Object.entries(INTENTS)
        .map(([key, val]) => `${key}: ${val.description}`)
        .join('\n');
}

module.exports = { INTENTS, getNeeds, getTool, getIntentNames, getIntentDescriptions };