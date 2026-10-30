const { Op } = require('sequelize');
const md = require('../models');

// Registro de eventos/errores del sistema (tabla system_events). Se consulta en Configuraciones > Registro de errores
// (solo superadmin). Sirve para enterarse de fallos que de otra forma solo quedan en la consola del servidor.
//
//   logEvent({ category: 'whatsapp', source: 'nuevo_brief', message: 'No se pudo enviar', detail: { ... } })
//
// NUNCA lanza error ni se espera su resultado: registrar un fallo no puede romper el proceso que falló.
const CATEGORIES = {
    asistente_ia: 'Asistente IA',
    whatsapp: 'WhatsApp',
    servidor: 'Servidor',
    seguridad: 'Seguridad',
};
const RETENTION_DAYS = 90;

const trim = (value, max) => (value == null ? null : String(value).slice(0, max));

// Quién estaba conectado: usuario del sistema o, en el portal de clientes, la empresa.
const whoIs = (req) => {
    if (req?.user) return { user_id: req.user.id ?? null, user_name: trim(req.user.nombre || req.user.email, 150) };
    if (req?.session?.empresaId) return { user_id: null, user_name: `Cliente (empresa ${req.session.empresaId})` };
    return { user_id: null, user_name: null };
};

const logEvent = ({ level = 'error', category, source = null, message, detail = null, error = null, req = null, statusCode = null }) => {
    // El error original (stack incluido) se guarda como detalle técnico; el mensaje queda legible.
    const fullDetail = {
        ...(detail ?? {}),
        ...(error ? { error: error.message, stack: trim(error.stack, 4000) } : {}),
    };
    md.system_events
        .create({
            level,
            category,
            source: trim(source, 120),
            message: trim(message ?? error?.message ?? 'Error sin mensaje', 2000),
            detail: Object.keys(fullDetail).length ? fullDetail : null,
            method: trim(req?.method, 10),
            path: trim(req?.originalUrl?.split('?')[0], 300),
            status_code: statusCode,
            ...whoIs(req),
        })
        .catch((e) => console.error('[system_events] No se pudo registrar el evento:', e.message));
};

// Borra los eventos más viejos que RETENTION_DAYS para que la tabla no crezca sin fin.
const purgeOldEvents = async () => {
    try {
        const limit = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
        const deleted = await md.system_events.destroy({ where: { created_at: { [Op.lt]: limit } } });
        if (deleted) console.log(`[system_events] ${deleted} eventos de más de ${RETENTION_DAYS} días eliminados`);
    } catch (e) {
        console.error('[system_events] No se pudo limpiar el registro:', e.message);
    }
};

// Middleware: registra las respuestas 5xx de cualquier endpoint. La mayoría de los controladores atrapan su error y
// responden 500 por su cuenta, así que se engancha en `res.json` para guardar también el mensaje que devolvieron.
const requestErrorLogger = (req, res, next) => {
    const originalJson = res.json.bind(res);
    res.json = (body) => {
        res.locals.responseBody = body;
        return originalJson(body);
    };
    res.on('finish', () => {
        if (res.statusCode < 500 || res.locals.eventLogged) return;
        const body = res.locals.responseBody;
        logEvent({
            category: 'servidor',
            source: `${req.method} ${req.route?.path ?? req.originalUrl?.split('?')[0]}`,
            message: body?.message || body?.error || `Respuesta ${res.statusCode}`,
            req,
            statusCode: res.statusCode,
        });
    });
    next();
};

module.exports = { logEvent, purgeOldEvents, requestErrorLogger, CATEGORIES };
