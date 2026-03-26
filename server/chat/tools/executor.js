const getCampaignStatus = require('./getCampaignStatus.tool');
const getDailyData = require('./getDailyData.tool');
const getProjection = require('./getProjection.tool');
const getClientSummary = require('./getClientSummary.tool');
const getActiveCampaigns = require('./getActiveCampaigns.tool');
const getLowPerformance = require('./getLowPerformance.tool');
const getExpiringCampaigns = require('./getExpiringCampaigns.tool');
const generateCampaignReport = require('./generateCampaignReport.tool');

// Mapa de nombre → función
const toolMap = {
    get_campaign_status: getCampaignStatus,
    get_daily_data: getDailyData,
    get_projection: getProjection,
    get_client_summary: getClientSummary,
    get_active_campaigns: getActiveCampaigns,
    get_low_performance: getLowPerformance,
    get_expiring_campaigns: getExpiringCampaigns,
    generate_campaign_report: generateCampaignReport
};

async function executeTool(calls) {
    const resultados = {};

    for (const call of calls) {
        const fn = toolMap[call.herramienta];

        if (!fn) {
            console.warn(`Tool no encontrado: ${call.herramienta}`);
            resultados[call.herramienta] = {
                error: `Herramienta "${call.herramienta}" no disponible`
            };
            continue;
        }

        try {
            resultados[call.herramienta] = await fn(call.parametros);
        } catch (error) {
            console.error(`Error ejecutando ${call.herramienta}:`, error);
            resultados[call.herramienta] = {
                error: `Error al ejecutar ${call.herramienta}: ${error.message}`
            };
        }
    }

    return resultados;
}

module.exports = { executeTool };