const INTENTS = {
    campaign_status: {
        needs: ['company', 'campaign'],
        tool: 'get_campaign_status',
        description: 'Estado general de una campaña: presupuesto, KPIs, avance, CTR, fechas. Palabras clave: estado, cómo va, resumen, avance, rendimiento',
        keywords: 'cómo va, estado, resumen, avance, rendimiento',
        neutral_question: 'Dame el estado de esta campaña'
    },
    daily_data: {
        needs: ['company', 'campaign'],
        tool: 'get_daily_data',
        description: 'Valores numéricos por día de una campaña. Palabras clave: datos diarios, por día, clicks por día, impresiones por día, valores diarios, histórico diario',
        keywords: 'datos diarios, por día, cada día, histórico, valores diarios',
        neutral_question: 'Dame los datos diarios de esta campaña'
    },
    projection: {
        needs: ['company', 'campaign'],
        tool: 'get_projection',
        description: 'Proyección de si la campaña alcanzará su objetivo',
        keywords: 'va a llegar, llegará, meta, proyección, alcanzar',
        neutral_question: '¿Va a llegar a la meta esta campaña?'
    },
    client_summary: {
        needs: ['company'],
        tool: 'get_client_summary',
        description: 'Resumen general de un cliente: campañas activas, presupuesto total, rendimiento general',
        keywords: 'resumen del cliente, todas las campañas de',
        neutral_question: 'Dame el resumen de este cliente'
    },
    active_campaigns: {
        needs: ['company'],
        tool: 'get_active_campaigns',
        description: 'Lista de campañas activas de un cliente',
        keywords: 'campañas activas, campañas vigentes, listado de campañas',
        neutral_question: 'Dame las campañas activas de este cliente'
    },
    low_performance: {
        needs: [],
        tool: 'get_low_performance',
        description: 'Campañas que están por debajo de su KPI esperado',
        keywords: 'van mal, bajo rendimiento, problemas, alertas',
        neutral_question: 'Dame las campañas con bajo rendimiento'
    },
    expiring_campaigns: {
        needs: [],
        tool: 'get_expiring_campaigns',
        description: 'Campañas que están por expirar o vencer pronto',
        keywords: 'vencen, por vencer, terminan pronto',
        neutral_question: '¿Cuándo vence esta campaña?'
    },
    full_report: {
        needs: ['company', 'campaign'],
        tool: 'generate_campaign_report',
        description: 'Informe completo de una campaña',
        keywords: 'reporte, informe, generar, documento',
        neutral_question: 'Genera el reporte de esta campaña'
    },
    global_budget: {
        needs: [],
        tool: 'get_global_budget',
        description: 'Resumen del presupuesto de todas las campañas activas',
        keywords: 'presupuesto global, presupuesto total, todos los presupuestos',
        neutral_question: 'Dame el resumen de presupuestos'
    },
    unknown: {
        needs: [],
        tool: 'handle_unknown',
        description: 'Intent no reconocido o pregunta que no encaja en las otras categorías',
        keywords: '',
        neutral_question: 'No entiendo tu pregunta, ¿puedes reformularla?'
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
        .map(([key, val]) => `${key}: ${val.description} Palabras clave: ${val.keywords}`)
        .join('\n');
}

const getNeutralQuestion = (intent) => {
    return INTENTS[intent]?.neutral_question || 'Dame información sobre esta campaña';
}

module.exports = { INTENTS, getNeeds, getTool, getIntentNames, getIntentDescriptions, getNeutralQuestion };