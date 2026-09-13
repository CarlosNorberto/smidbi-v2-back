const { sessionAuth, requireRole, clientSessionAuth } = require('../auth/middleware');
const usuarios = require('../controllers/usuarios');
const utilities = require('../controllers/utilities');
const systemSettings = require('../controllers/system_settings');
const clientAuth = require('../controllers/client_auth');
const requestBrief = require('../controllers/request_brief');
const qualifyBrief = require('../controllers/qualify_brief');
const costoPor = require('../controllers/costo_por');

const multer = require('multer');
const uploadQualifyImage = multer({
    storage: multer.memoryStorage(),
    fileFilter: (req, file, cb) => {
        if (!file.mimetype.startsWith('image/')) {
            return cb(new Error('Solo se permiten archivos de imagen!'), false);
        }
        cb(null, true);
    },
    limits: { fileSize: 5 * 1024 * 1024, files: 1 } // 5 MB
});

module.exports = (app) => {

    // USUARIOS
    // /users/all NO es exclusivo de la sección de gestión: lo usan también
    // Tareas, Contratos, Seguimiento, Revisión de Reportes y el filtro de
    // Empresas para listar usuarios y poder asignarles cosas. Queda abierto
    // a cualquier usuario interno logueado.
    app.get(process.env.PREFIX_API + '/users/all', sessionAuth, usuarios.getAll);
    // /users/save sí es exclusivo de la página de gestión de usuarios (admin/superadmin).
    app.post(process.env.PREFIX_API + '/users/save', sessionAuth, requireRole('admin', 'superadmin'), usuarios.saveUpdate);
    // cambio de la propia contraseña: abierto a cualquier usuario logueado,
    // siempre exige la contraseña actual (no es parte de la gestión de usuarios).
    app.put(process.env.PREFIX_API + '/users/change_password/:id', sessionAuth, usuarios.changePassword);

    // AUTH DE CLIENTES (empresas) - independiente del login de usuarios internos
    app.post(process.env.PREFIX_API + '/auth/client/login', clientAuth.login);
    app.get(process.env.PREFIX_API + '/auth/client/token/:token', clientAuth.loginByToken);
    app.post(process.env.PREFIX_API + '/auth/client/logout', clientAuth.logout);
    app.get(process.env.PREFIX_API + '/auth/client/me', clientSessionAuth, clientAuth.me);

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

    // SOLICITUDES DE BRIEF (formulario público de la app antigua, tabla compartida)
    // Fase 1: solo listado paginado + detalle. Sin filtros ni edición todavía.
    app.get(process.env.PREFIX_API + '/request_briefs/all', sessionAuth, requestBrief.getAll);
    app.get(process.env.PREFIX_API + '/request_briefs/one/:id', sessionAuth, requestBrief.getById);
    app.post(process.env.PREFIX_API + '/request_briefs/:id/duplicate', sessionAuth, requestBrief.duplicate);

    // CALIFICACIÓN DE BRIEF (q1-q4 / RATE CARD + imágenes de respaldo)
    app.get(process.env.PREFIX_API + '/qualify_briefs/by_brief/:id_brief', sessionAuth, qualifyBrief.getByBriefId);
    app.post(process.env.PREFIX_API + '/qualify_briefs/save', sessionAuth, qualifyBrief.saveUpdate);
    app.get(process.env.PREFIX_API + '/qualify_briefs/images/:id_brief', sessionAuth, qualifyBrief.getImagesByBriefId);
    app.post(process.env.PREFIX_API + '/qualify_briefs/images/:id_brief/upload', sessionAuth, uploadQualifyImage.single('image'), qualifyBrief.uploadImage);
    app.put(process.env.PREFIX_API + '/qualify_briefs/images/:id', sessionAuth, qualifyBrief.updateImageDescription);
    app.delete(process.env.PREFIX_API + '/qualify_briefs/images/:id', sessionAuth, qualifyBrief.deleteImage);
    app.get(process.env.PREFIX_API + '/qualify_briefs/ratecard_groups', sessionAuth, costoPor.getRateCardGroups);

    // ADMINISTRACIÓN DE RATE CARD (costo_por) — superadmin. No se borra, solo se
    // activa/desactiva (mismo criterio que plataformas).
    app.get(process.env.PREFIX_API + '/costo_por/admin/all', sessionAuth, requireRole('superadmin'), costoPor.getAllAdmin);
    app.post(process.env.PREFIX_API + '/costo_por/create', sessionAuth, requireRole('superadmin'), costoPor.create);
    app.put(process.env.PREFIX_API + '/costo_por/update/:id', sessionAuth, requireRole('superadmin'), costoPor.update);

}
