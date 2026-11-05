const { sessionAuth, requireRole } = require('../../auth/middleware');
const { LEAD_MANAGER_ROLES } = require('../../auth/roles');
const etapas = require('../../controllers/lead_manager/stages');
const deals = require('../../controllers/lead_manager/deals');
const estados = require('../../controllers/lead_manager/status');
const servicios = require('../../controllers/lead_manager/services');
const prospect_history = require('../../controllers/lead_manager/prospect_history');
const follow_ups = require('../../controllers/lead_manager/follow_ups');
const prospectos = require('../../controllers/lead_manager/prospects');
const industries = require('../../controllers/lead_manager/industries');
const responsibles = require('../../controllers/lead_manager/responsibles');
const customer_temperature = require('../../controllers/lead_manager/customer_temperature');

module.exports=(app)=>{

    // TODO el CRM (leer y escribir, incluidas las etapas y temperaturas) es solo de admin, superadmin y el rol "leads".
    const access = [sessionAuth, requireRole(...LEAD_MANAGER_ROLES)];

    // STAGES (ETAPAS)
    app.get(process.env.PREFIX_API + '/lead_manager/stages/all', ...access, etapas.getAll);   
    app.patch(process.env.PREFIX_API + '/lead_manager/stages/reorder', ...access, etapas.reorder);
    app.put(process.env.PREFIX_API + '/lead_manager/stages/update/:id', ...access, etapas.update);
    app.post(process.env.PREFIX_API + '/lead_manager/stages/create', ...access, etapas.create);

    // DEALS (NEGOCIOS)
    app.get(process.env.PREFIX_API + '/lead_manager/deals/by_stage', ...access, deals.getByStage);     
    app.patch(process.env.PREFIX_API + '/lead_manager/deals/reorder', ...access, deals.reorder);

    // ESTADOS
    app.get(process.env.PREFIX_API + '/lead_manager/status/all', ...access, estados.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/status/save_update', ...access, estados.saveUpdate);

    // SERVICIOS
    app.get(process.env.PREFIX_API + '/lead_manager/services/all', ...access, servicios.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/services/save_update', ...access, servicios.saveUpdate);

    // RESPONSIBLES
    app.get(process.env.PREFIX_API + '/lead_manager/responsibles/all', ...access, responsibles.getAll);

    // CUSTOMER TEMPERATURE
    app.get(process.env.PREFIX_API + '/lead_manager/customer_temperature/all', ...access, customer_temperature.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/customer_temperature/create', ...access, customer_temperature.create);
    app.put(process.env.PREFIX_API + '/lead_manager/customer_temperature/update/:id', ...access, customer_temperature.update);
    app.patch(process.env.PREFIX_API + '/lead_manager/customer_temperature/reorder', ...access, customer_temperature.reorder);
    app.delete(process.env.PREFIX_API + '/lead_manager/customer_temperature/remove/:id', ...access, customer_temperature.remove);

    // HISTORIAL DE PROSPECTOS
    app.get(process.env.PREFIX_API + '/lead_manager/prospect_history/one/:id', ...access, prospect_history.getById);
    app.get(process.env.PREFIX_API + '/lead_manager/prospect_history/all', ...access, prospect_history.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/prospect_history/create', ...access, prospect_history.create);
    app.put(process.env.PREFIX_API + '/lead_manager/prospect_history/update/:id', ...access, prospect_history.update);
    app.delete(process.env.PREFIX_API + '/lead_manager/prospect_history/remove/:id', ...access, prospect_history.remove);

    // HISTORIAL DE GESTIONES (correo, WhatsApp, llamada, reunión) de una oportunidad
    app.get(process.env.PREFIX_API + '/lead_manager/follow_ups/by_deal/:id', ...access, follow_ups.getByDeal);
    app.post(process.env.PREFIX_API + '/lead_manager/follow_ups/create', ...access, follow_ups.create);
    app.put(process.env.PREFIX_API + '/lead_manager/follow_ups/update/:id', ...access, follow_ups.update);
    app.delete(process.env.PREFIX_API + '/lead_manager/follow_ups/remove/:id', ...access, follow_ups.remove);

    // RUBROS / SECTORES de los prospectos
    app.get(process.env.PREFIX_API + '/lead_manager/industries/all', ...access, industries.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/industries/create', ...access, industries.create);

    // PROSPECTOS
    app.get(process.env.PREFIX_API + '/lead_manager/prospects/all', ...access, prospectos.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/prospects/create', ...access, prospectos.create);
    app.patch(process.env.PREFIX_API + '/lead_manager/prospects/update/:id', ...access, prospectos.update);
}
    