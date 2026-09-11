const { sessionAuth, requireRole } = require('../auth/middleware');
const usuarios = require('../controllers/usuarios');
const utilities = require('../controllers/utilities');
const systemSettings = require('../controllers/system_settings');

module.exports = (app) => {

    // USUARIOS
    app.get(process.env.PREFIX_API + '/users/all', sessionAuth, usuarios.getAll);
    app.post(process.env.PREFIX_API + '/users/save', sessionAuth, usuarios.saveUpdate);
    app.put(process.env.PREFIX_API + '/users/change_password/:id', sessionAuth, usuarios.changePassword);

    // UTILIDADES
    app.get(process.env.PREFIX_API + '/utilities/campaign_search', sessionAuth, utilities.campaignSearch);
    app.get(process.env.PREFIX_API + '/utilities/campaign_search/filters', sessionAuth, utilities.campaignSearchFilters);
    app.get(process.env.PREFIX_API + '/utilities/company_search', sessionAuth, utilities.companySearch);

    // CONFIGURACIONES GENERALES (acceso exclusivo para superadmin)
    app.get(process.env.PREFIX_API + '/system_settings/all', sessionAuth, requireRole('superadmin'), systemSettings.getAll);
    app.get(process.env.PREFIX_API + '/system_settings/one/:id', sessionAuth, requireRole('superadmin'), systemSettings.getById);
    app.post(process.env.PREFIX_API + '/system_settings/create', sessionAuth, requireRole('superadmin'), systemSettings.create);
    app.put(process.env.PREFIX_API + '/system_settings/update/:id', sessionAuth, requireRole('superadmin'), systemSettings.update);
    app.delete(process.env.PREFIX_API + '/system_settings/remove/:id', sessionAuth, requireRole('superadmin'), systemSettings.remove);

}
