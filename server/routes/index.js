const { sessionAuth, requireRole, clientSessionAuth } = require('../auth/middleware');
const { rateLimit } = require('../auth/rate_limit');
const usuarios = require('../controllers/usuarios');
const utilities = require('../controllers/utilities');
const systemSettings = require('../controllers/system_settings');
const clientAuth = require('../controllers/client_auth');
const requestBrief = require('../controllers/request_brief');
const reportPublic = require('../controllers/report_public');
const qualifyBrief = require('../controllers/qualify_brief');
const costoPor = require('../controllers/costo_por');
const whatsapp = require('../controllers/whatsapp');
const whatsappDestinatarios = require('../controllers/whatsapp_destinatarios');
const contactSettings = require('../controllers/contact_settings');
const systemEvents = require('../controllers/system_events');
const notifications = require('../controllers/notifications');

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
    app.get(process.env.PREFIX_API + '/utilities/report_search', sessionAuth, utilities.reportSearch);
    app.get(process.env.PREFIX_API + '/utilities/report_search/filters', sessionAuth, utilities.reportSearchFilters);
    app.get(process.env.PREFIX_API + '/utilities/category_search', sessionAuth, utilities.categorySearch);
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
    app.put(process.env.PREFIX_API + '/request_briefs/:id/strategy', sessionAuth, requestBrief.updateStrategy);
    // Formulario público de brief (sin login): máx. 5 envíos por hora por IP.
    app.post(
        process.env.PREFIX_API + '/public/request_briefs',
        rateLimit({ windowMs: 60 * 60 * 1000, max: 5, message: 'Ha enviado demasiadas solicitudes. Intente nuevamente más tarde.' }),
        requestBrief.createPublic
    );
    // Brief de solo lectura para el link firmado de la plantilla de WhatsApp (sin login; ver utils/briefLink.js).
    app.get(
        process.env.PREFIX_API + '/public/request_briefs/view/:code',
        rateLimit({ windowMs: 60 * 60 * 1000, max: 120, message: 'Demasiadas consultas. Intente nuevamente más tarde.' }),
        requestBrief.getPublicView
    );

    // Ubica el reporte del link firmado de la plantilla de WhatsApp "reporte_creado" (sin login; ver
    // utils/reportLink.js). El mismo límite que la vista pública del brief.
    app.get(
        process.env.PREFIX_API + '/public/reports/view/:token',
        rateLimit({ windowMs: 60 * 60 * 1000, max: 120, message: 'Demasiadas consultas. Intente nuevamente más tarde.' }),
        reportPublic.resolveToken
    );

    // CALIFICACIÓN DE BRIEF (q1-q4 / RATE CARD + imágenes de respaldo)
    app.get(process.env.PREFIX_API + '/qualify_briefs/by_brief/:id_brief', sessionAuth, qualifyBrief.getByBriefId);
    app.post(process.env.PREFIX_API + '/qualify_briefs/save', sessionAuth, qualifyBrief.saveUpdate);
    app.get(process.env.PREFIX_API + '/qualify_briefs/images/:id_brief', sessionAuth, qualifyBrief.getImagesByBriefId);
    app.post(process.env.PREFIX_API + '/qualify_briefs/images/:id_brief/upload', sessionAuth, uploadQualifyImage.single('image'), qualifyBrief.uploadImage);
    app.put(process.env.PREFIX_API + '/qualify_briefs/images/:id', sessionAuth, qualifyBrief.updateImageDescription);
    app.delete(process.env.PREFIX_API + '/qualify_briefs/images/:id', sessionAuth, qualifyBrief.deleteImage);
    app.get(process.env.PREFIX_API + '/qualify_briefs/ratecard_groups', sessionAuth, costoPor.getRateCardGroups);

    // ADMINISTRACIÓN DE RATE CARD (costo_por) — admin/superadmin. No se borra, solo se
    // activa/desactiva (mismo criterio que plataformas).
    app.get(process.env.PREFIX_API + '/costo_por/admin/all', sessionAuth, requireRole('admin', 'superadmin'), costoPor.getAllAdmin);
    app.post(process.env.PREFIX_API + '/costo_por/create', sessionAuth, requireRole('admin', 'superadmin'), costoPor.create);
    app.put(process.env.PREFIX_API + '/costo_por/update/:id', sessionAuth, requireRole('admin', 'superadmin'), costoPor.update);

    // WHATSAPP — envío de prueba (superadmin)
    app.post(process.env.PREFIX_API + '/whatsapp/send', sessionAuth, requireRole('superadmin'), whatsapp.send);

    // WHATSAPP — destinatarios de avisos por proceso (Configuraciones > Notificaciones WhatsApp, admin/superadmin)
    // Número de WhatsApp de atención del home público (el GET público solo expone ese número).
    app.get(process.env.PREFIX_API + '/public/contact', rateLimit({ windowMs: 60 * 60 * 1000, max: 300, message: 'Demasiadas consultas.' }), contactSettings.getPublic);
    app.get(process.env.PREFIX_API + '/contact_settings', sessionAuth, requireRole('admin', 'superadmin'), contactSettings.get);
    app.put(process.env.PREFIX_API + '/contact_settings', sessionAuth, requireRole('admin', 'superadmin'), contactSettings.save);
    app.get(process.env.PREFIX_API + '/whatsapp_destinatarios/procesos', sessionAuth, requireRole('admin', 'superadmin'), whatsappDestinatarios.getProcesos);
    app.get(process.env.PREFIX_API + '/whatsapp_destinatarios/all', sessionAuth, requireRole('admin', 'superadmin'), whatsappDestinatarios.getAll);
    app.post(process.env.PREFIX_API + '/whatsapp_destinatarios/create', sessionAuth, requireRole('admin', 'superadmin'), whatsappDestinatarios.create);
    app.put(process.env.PREFIX_API + '/whatsapp_destinatarios/update/:id', sessionAuth, requireRole('admin', 'superadmin'), whatsappDestinatarios.update);
    app.delete(process.env.PREFIX_API + '/whatsapp_destinatarios/remove/:id', sessionAuth, requireRole('admin', 'superadmin'), whatsappDestinatarios.remove);

    // NOTIFICACIONES "Otros" de la campanita (del usuario conectado). Literales antes de la dinámica ':id'.
    app.get(process.env.PREFIX_API + '/notifications', sessionAuth, notifications.getMine);
    app.put(process.env.PREFIX_API + '/notifications/read_all', sessionAuth, notifications.markAllAsRead);
    app.put(process.env.PREFIX_API + '/notifications/:id/read', sessionAuth, notifications.markAsRead);

    // REGISTRO DE ERRORES (Configuraciones > Registro de errores) — SOLO superadmin
    app.get(process.env.PREFIX_API + '/system_events/categories', sessionAuth, requireRole('superadmin'), systemEvents.getCategories);
    app.get(process.env.PREFIX_API + '/system_events', sessionAuth, requireRole('superadmin'), systemEvents.getAll);

}
