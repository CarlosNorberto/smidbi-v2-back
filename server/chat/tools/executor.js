const getCampaignStatus = require('./getCampaignStatus.tool');
const getDailyData = require('./getDailyData.tool');
const getProjection = require('./getProjection.tool');
const getClientSummary = require('./getClientSummary.tool');
const getActiveCampaigns = require('./getActiveCampaigns.tool');
const getLowPerformance = require('./getLowPerformance.tool');
const getExpiringCampaigns = require('./getExpiringCampaigns.tool');
const generateCampaignReport = require('./generateCampaignReport.tool');
const getUsers = require('./getUsers.tool');
const getGlobalBudget = require('./getGlobalBudget.tools');
const handleUnknown = require('./handleUnknown.tool');

// Mapa de nombre → función
const toolMap = {
    get_campaign_status:        getCampaignStatus,
    get_daily_data:             getDailyData,
    get_projection:             getProjection,
    get_client_summary:         getClientSummary,
    get_active_campaigns:       getActiveCampaigns,
    get_low_performance:        getLowPerformance,
    get_expiring_campaigns:     getExpiringCampaigns,
    // generate_campaign_report:   generateCampaignReport,
    generate_campaign_report:   getCampaignStatus,
    get_users:                  getUsers,
    get_global_budget:          getGlobalBudget,
    handle_unknown:             handleUnknown
};

const executeTool = async (calls) => {
    const resultados = {};

    for (const call of calls) {
        const fn = toolMap[call.tool];

        if (!fn) {
            console.warn(`Tool no encontrado: ${call.tool}`);
            resultados[call.tool] = {
                error: `Herramienta "${call.tool}" no disponible`
            };
            continue;
        }

        try {
            resultados[call.tool] = await fn(call.params);
        } catch (error) {
            console.error(`Error ejecutando ${call.tool}:`, error);
            resultados[call.tool] = {
                error: `Error al ejecutar ${call.tool}: ${error.message}`
            };
        }
    }

    return resultados;
}

module.exports = executeTool;