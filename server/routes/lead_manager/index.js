const { sessionAuth } = require('../../auth/middleware');
const etapas = require('../../controllers/lead_manager/stages');
const deals = require('../../controllers/lead_manager/deals');
const estados = require('../../controllers/lead_manager/status');
const servicios = require('../../controllers/lead_manager/services');
const prospect_history = require('../../controllers/lead_manager/prospect_history');
const prospectos = require('../../controllers/lead_manager/prospects');
const responsibles = require('../../controllers/lead_manager/responsibles');
const customer_temperature = require('../../controllers/lead_manager/customer_temperature');

module.exports=(app)=>{

    // STAGES (ETAPAS)
    app.get(process.env.PREFIX_API + '/lead_manager/stages/all', sessionAuth, etapas.getAll);   
    app.patch(process.env.PREFIX_API + '/lead_manager/stages/reorder', sessionAuth, etapas.reorder);
    app.put(process.env.PREFIX_API + '/lead_manager/stages/update/:id', sessionAuth, etapas.update);
    app.post(process.env.PREFIX_API + '/lead_manager/stages/create', sessionAuth, etapas.create);

    // DEALS (NEGOCIOS)
    app.get(process.env.PREFIX_API + '/lead_manager/deals/by_stage', sessionAuth, deals.getByStage);     
    app.patch(process.env.PREFIX_API + '/lead_manager/deals/reorder', sessionAuth, deals.reorder);

    // ESTADOS
    app.get(process.env.PREFIX_API + '/lead_manager/status/all', sessionAuth, estados.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/status/save_update', sessionAuth, estados.saveUpdate);

    // SERVICIOS
    app.get(process.env.PREFIX_API + '/lead_manager/services/all', sessionAuth, servicios.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/services/save_update', sessionAuth, servicios.saveUpdate);

    // RESPONSIBLES
    app.get(process.env.PREFIX_API + '/lead_manager/responsibles/all', sessionAuth, responsibles.getAll);

    // CUSTOMER TEMPERATURE
    app.get(process.env.PREFIX_API + '/lead_manager/customer_temperature/all', sessionAuth, customer_temperature.getAll);

    // HISTORIAL DE PROSPECTOS
    app.get(process.env.PREFIX_API + '/lead_manager/prospect_history/one/:id', sessionAuth, prospect_history.getById);
    app.get(process.env.PREFIX_API + '/lead_manager/prospect_history/all', sessionAuth, prospect_history.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/prospect_history/create', sessionAuth, prospect_history.create);
    app.put(process.env.PREFIX_API + '/lead_manager/prospect_history/update/:id', sessionAuth, prospect_history.update);
    app.delete(process.env.PREFIX_API + '/lead_manager/prospect_history/remove/:id', sessionAuth, prospect_history.remove);

    // PROSPECTOS
    app.get(process.env.PREFIX_API + '/lead_manager/prospects/all', sessionAuth, prospectos.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/prospects/create', sessionAuth, prospectos.create);
    app.patch(process.env.PREFIX_API + '/lead_manager/prospects/update/:id', sessionAuth, prospectos.update);
}
    