const { sessionAuth } = require('../auth/middleware');
const usuarios = require('../controllers/usuarios');
const empresas = require('../controllers/empresas');
const categorias = require('../controllers/categorias');
const campanas = require('../controllers/campanas');
const reportes = require('../controllers/reportes');
const plataformas = require('../controllers/plataformas');
const objetivos = require('../controllers/objetivos');
const segmentaciones = require('../controllers/segmentacion');
const seguimiento = require('../controllers/seguimiento');

// multer for file uploads (if needed in the future)
const multer = require('multer');
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/ads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const fileFilter = (req, file, cb) => {
    // Accept images only
    if (!file.mimetype.startsWith('image/')) {
        return cb(new Error('Solo se permiten archivos de imagen!'), false);
    }
    cb(null, true);
};

const upload = multer({
    storage: storage,
    fileFilter: fileFilter,
    limits: { fileSize: 5 * 1024 * 1024, files: 1 } // 5 MB
});

module.exports = (app) => {

    // USUARIOS
    app.get(process.env.PREFIX_API + '/users/all', sessionAuth, usuarios.getAll);
    app.post(process.env.PREFIX_API + '/users/save', sessionAuth, usuarios.saveUpdate);
    app.put(process.env.PREFIX_API + '/users/change_password/:id', sessionAuth, usuarios.changePassword);

    // EMPRESAS
    app.get(process.env.PREFIX_API + '/companies/one/:id', sessionAuth, empresas.getById);
    app.get(process.env.PREFIX_API + '/companies/all', sessionAuth, empresas.getAll);
    app.get(process.env.PREFIX_API + '/companies/users/:user_ids', sessionAuth, empresas.getAllByUsers);
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
    app.put(process.env.PREFIX_API + '/reports/enable_disable/:id', sessionAuth, reportes.enableDisableReport);
    app.delete(process.env.PREFIX_API + '/reports/delete/:id', sessionAuth, reportes.deleteReport);

    // OBJETIVOS SECUNDARIOS
    app.get(process.env.PREFIX_API + '/reports/secondary_objectives/:report_id', sessionAuth, reportes.getSecondaryObjectivesByReportId);
    app.post(process.env.PREFIX_API + '/reports/secondary_objectives/save/:report_id', sessionAuth, reportes.saveUpdateSecondaryObjectives);

    // GENERO
    app.get(process.env.PREFIX_API + '/reports/gender/:report_id', sessionAuth, reportes.getGenderByReportId);
    app.post(process.env.PREFIX_API + '/reports/gender/save/:report_id', sessionAuth, reportes.saveUpdateGender);

    // DISPOSITIVOS
    app.get(process.env.PREFIX_API + '/reports/devices/:report_id', sessionAuth, reportes.getDevicesByReportId);
    app.post(process.env.PREFIX_API + '/reports/devices/save/:report_id', sessionAuth, reportes.saveUpdateDevices);

    // HORAS
    app.get(process.env.PREFIX_API + '/reports/hours/:report_id', sessionAuth, reportes.getHoursByReportId);
    app.post(process.env.PREFIX_API + '/reports/hours/save/:report_id', sessionAuth, reportes.saveUpdateHours);

    // VIEW ADS
    app.get(process.env.PREFIX_API + '/reports/view_ads/:report_id', sessionAuth, reportes.getViewAdsByReportId);
    app.post(process.env.PREFIX_API + '/reports/view_ads/save/:report_id', sessionAuth, reportes.saveUpdateViewAds);
    app.post(process.env.PREFIX_API + '/reports/view_ads/upload_image/:report_id', sessionAuth, upload.single('ad_image'), reportes.uploadAdImage);
    app.delete(process.env.PREFIX_API + '/reports/view_ads/delete_image/:imagen', sessionAuth, reportes.deleteAdImage);

    // DÍAS DE REPORTES
    app.get(process.env.PREFIX_API + '/reports/days/:report_id', sessionAuth, reportes.getDaysByReportId);
    app.put(process.env.PREFIX_API + '/reports/day/update', reportes.updateReporteDia);
    app.post(process.env.PREFIX_API + '/reports/day/review/:page/:limit', reportes.reporteDiasReview);
    app.put(process.env.PREFIX_API + '/reports/days/update_all/:report_id', sessionAuth, reportes.updateAllDaysByReportAndObjetivo);

    // MAPA
    app.get(process.env.PREFIX_API + '/reports/map/:report_id', sessionAuth, reportes.getMapByReportID);

    // PLATAFORMAS
    app.get(process.env.PREFIX_API + '/platforms/all', sessionAuth, plataformas.getAll);

    // OBJETIVOS
    app.get(process.env.PREFIX_API + '/objectives/all', sessionAuth, objetivos.getAll);

    // SEGMENTACION
    app.get(process.env.PREFIX_API + '/segmentations/all/:report_id', sessionAuth, segmentaciones.getAllByReportId);
    app.post(process.env.PREFIX_API + '/segmentations/save', sessionAuth, segmentaciones.saveUpdate);

    // SEGUIMIENTO
    app.post(process.env.PREFIX_API + '/tracking/load', sessionAuth, seguimiento.loadTracking);

    // GESTOR DE PROSPECTOS - LEAD MANAGER


}