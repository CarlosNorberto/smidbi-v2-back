const { sessionAuth } = require('../auth/middleware');
const usuarios = require('../controllers/usuarios');
const empresas = require('../controllers/empresas');
const categorias = require('../controllers/categorias');
const campanas = require('../controllers/campanas');
const reportes = require('../controllers/reportes');
const plataformas = require('../controllers/plataformas');
const objetivos = require('../controllers/objetivos');
const segmentaciones = require('../controllers/segmentacion');

module.exports=(app)=>{

    // USUARIOS
    app.get(process.env.PREFIX_API + '/users/all', sessionAuth, usuarios.getAll);
    app.post(process.env.PREFIX_API + '/users/save', sessionAuth, usuarios.saveUpdate);

    // EMPRESAS
    app.get(process.env.PREFIX_API + '/companies/one/:id', sessionAuth, empresas.getById);
    app.get(process.env.PREFIX_API + '/companies/all/:user_ids', sessionAuth, empresas.getAllByUsers);
    app.post(process.env.PREFIX_API + '/companies/create', sessionAuth, empresas.create);
    app.put(process.env.PREFIX_API + '/companies/update/:id', sessionAuth, empresas.update);

    // CATEGORIAS
    app.get(process.env.PREFIX_API + '/categories/one/:id', sessionAuth, categorias.getById);
    app.get(process.env.PREFIX_API + '/categories/all/:company_id', sessionAuth, categorias.getAllByCompany);

    // CAMPAÑAS
    app.get(process.env.PREFIX_API + '/campaigns/one/:id', sessionAuth, campanas.getById);
    app.get(process.env.PREFIX_API + '/campaigns/all/:category_id', sessionAuth, campanas.getByCategory);

    // REPORTES
    app.get(process.env.PREFIX_API + '/reports/one/:id', sessionAuth, reportes.getById);
    app.get(process.env.PREFIX_API + '/reports/all/:campaign_id', sessionAuth, reportes.getAllByCampaign);
    app.post(process.env.PREFIX_API + '/reports/all/:page/:limit', sessionAuth, reportes.getAllByUser);
    app.post(process.env.PREFIX_API + '/reports/save', sessionAuth, reportes.saveUpdate);

    // DÍAS DE REPORTES
    app.get(process.env.PREFIX_API + '/reports/days/:report_id', sessionAuth, reportes.getDaysByReportId);
    app.put(process.env.PREFIX_API + '/reports/day/update', reportes.updateReporteDia);
    app.post(process.env.PREFIX_API + '/reports/day/review/:page/:limit', reportes.reporteDiasReview);
    app.put(process.env.PREFIX_API + '/reports/days/update_all/:report_id', sessionAuth, reportes.updateAllDaysByReportAndObjetivo);

    // PLATAFORMAS
    app.get(process.env.PREFIX_API + '/platforms/all', sessionAuth, plataformas.getAll);

    // OBJETIVOS
    app.get(process.env.PREFIX_API + '/objectives/all', sessionAuth, objetivos.getAll);

    // SEGMENTACION
    app.get(process.env.PREFIX_API + '/segmentations/all/:report_id', sessionAuth, segmentaciones.getAllByReportId);
    app.post(process.env.PREFIX_API + '/segmentations/save', sessionAuth, segmentaciones.saveUpdate);
    
}