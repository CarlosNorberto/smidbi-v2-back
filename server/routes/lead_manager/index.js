const { sessionAuth } = require('../../auth/middleware');
const etapas = require('../../controllers/lead_manager/stages');
const deals = require('../../controllers/lead_manager/deals');
const estados = require('../../controllers/lead_manager/status');
const servicios = require('../../controllers/lead_manager/services');
const prospectos = require('../../controllers/lead_manager/prospects');

module.exports=(app)=>{

    // STAGES (ETAPAS)
    app.get(process.env.PREFIX_API + '/lead_manager/stages/all', sessionAuth, etapas.getAll);   

    // DEALS (NEGOCIOS)
    app.get(process.env.PREFIX_API + '/lead_manager/deals/by_stage', sessionAuth, deals.getByStage); 

    // ESTADOS
    app.get(process.env.PREFIX_API + '/lead_manager/status/all', sessionAuth, estados.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/status/save_update', sessionAuth, estados.saveUpdate);

    // SERVICIOS
    app.get(process.env.PREFIX_API + '/lead_manager/services/all', sessionAuth, servicios.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/services/save_update', sessionAuth, servicios.saveUpdate);

    // PROSPECTOS
    app.get(process.env.PREFIX_API + '/lead_manager/prospects/all', sessionAuth, prospectos.getAll);
    app.post(process.env.PREFIX_API + '/lead_manager/prospects/save_update', sessionAuth, prospectos.saveUpdate);
}
    