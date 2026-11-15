const { AsyncLocalStorage } = require('async_hooks');
const md = require('../models');

// "Ingresar como" (solo superadmin): el superadmin entra al sistema con la sesión de otro usuario y todo lo que hace
// queda a nombre de ese usuario (usuario_creacion, responsables, etc.), pero se registra en system_events quién lo hizo
// de verdad, en la categoría 'suplantacion'. Esas entradas no se borran con la limpieza de 90 días (ver
// systemEventService.purgeOldEvents).
//
// Cómo se registra lo que se modifica:
//   1. `impersonationContext` (middleware, después de passport) abre un contexto por petición (AsyncLocalStorage) SOLO
//      si la sesión es de suplantación.
//   2. Los hooks globales de Sequelize (`installAuditHooks`) anotan en ese contexto cada alta, cambio (con el valor
//      anterior y el nuevo de cada campo) y baja que haga la petición.
//   3. Al terminar la petición (solo POST/PUT/PATCH/DELETE; las consultas no se registran) se guarda UNA entrada con el
//      resumen legible y, en `detail`, el listado completo de cambios y el cuerpo enviado (sin contraseñas ni tokens).

const CATEGORY = 'suplantacion';
const als = new AsyncLocalStorage();

const trim = (value, max) => (value == null ? null : String(value).slice(0, max));

// Tablas que no se anotan: el propio registro (se cicla) y las notificaciones (efecto secundario de otras acciones).
const IGNORED_TABLES = new Set(['system_events', 'notifications']);
// Campos de control que cambian solos en cada guardado: no son "un cambio" del usuario.
const IGNORED_FIELDS = new Set([
    'fecha_modificacion', 'usuario_modificacion', 'fecha_creacion', 'usuario_creacion', 'fecha_eliminacion',
    'usuario_eliminacion', 'write_date', 'create_date', 'updated_at', 'created_at', 'updatedAt', 'createdAt',
]);
const SENSITIVE = /pass|token|secret|clave|api_?key/i;

const ENTITY_LABELS = {
    empresas: 'la empresa', campanas: 'la campaña', categorias: 'la categoría', reportes: 'el reporte',
    usuarios: 'el usuario', contracts: 'el contrato', company_form: 'los datos de la empresa del contrato',
    signed_contracts: 'un contrato firmado', application_status: 'un estado de solicitud', prospects: 'el prospecto',
    tasks_cards: 'la tarjeta de tarea', tasks_lists: 'la lista de tareas', objetivos: 'el objetivo',
    plataformas: 'la plataforma', view_ads: 'el anuncio', system_settings: 'la configuración del sistema',
};
const NAME_FIELDS = ['nombre', 'name', 'company_name', 'titulo', 'title', 'application_status_name', 'descripcion'];

const entityLabel = (table) => ENTITY_LABELS[table] ?? `el registro de ${table}`;
// Nombre con el que se identifica el registro. En un cambio se usa el valor ANTERIOR: si lo que se cambió es justo el
// nombre, el mensaje debe decir "cambió «A» → «B»" y no nombrar el registro con el valor nuevo.
const recordName = (instance, beforeChange = false) => {
    for (const field of NAME_FIELDS) {
        const value = beforeChange && instance.changed?.(field) ? instance.previous(field) : instance.get?.(field);
        if (typeof value === 'string' && value.trim()) return trim(value.trim(), 80);
    }
    return null;
};

const formatValue = (value) => {
    if (value === null || value === undefined || value === '') return '(vacío)';
    if (value instanceof Date) return value.toISOString().slice(0, 19).replace('T', ' ');
    if (typeof value === 'object') return trim(JSON.stringify(value), 120);
    return trim(value, 120);
};
// Contraseñas y tokens: se anota que cambiaron, nunca su valor.
const safeValue = (field, value) => (SENSITIVE.test(field) ? '(oculto)' : formatValue(value));

const note = (change) => {
    const store = als.getStore();
    if (store) store.changes.push(change);
};

const installAuditHooks = () => {
    const sequelize = md.sequelize;
    sequelize.addHook('afterCreate', (instance) => {
        const table = instance.constructor.tableName;
        if (!als.getStore() || IGNORED_TABLES.has(table)) return;
        note({ action: 'create', table, id: instance.get('id') ?? null, name: recordName(instance) });
    });
    sequelize.addHook('afterUpdate', (instance) => {
        const table = instance.constructor.tableName;
        if (!als.getStore() || IGNORED_TABLES.has(table)) return;
        const fields = (instance.changed() || []).filter((field) => !IGNORED_FIELDS.has(field));
        if (!fields.length) return;
        note({
            action: 'update', table, id: instance.get('id') ?? null, name: recordName(instance, true),
            fields: fields.map((field) => ({
                field, from: safeValue(field, instance.previous(field)), to: safeValue(field, instance.get(field)),
            })),
        });
    });
    sequelize.addHook('afterDestroy', (instance) => {
        const table = instance.constructor.tableName;
        if (!als.getStore() || IGNORED_TABLES.has(table)) return;
        note({ action: 'destroy', table, id: instance.get('id') ?? null, name: recordName(instance) });
    });
    // Operaciones masivas (Model.update / destroy con `where`): no hay valor anterior, se anota el nuevo y el filtro.
    sequelize.addHook('afterBulkUpdate', (options) => {
        const table = options.model?.tableName;
        if (!als.getStore() || !table || IGNORED_TABLES.has(table)) return;
        const fields = Object.keys(options.attributes ?? {}).filter((field) => !IGNORED_FIELDS.has(field));
        if (!fields.length) return;
        note({
            action: 'bulk_update', table, where: trim(JSON.stringify(options.where), 200),
            fields: fields.map((field) => ({ field, to: safeValue(field, options.attributes[field]) })),
        });
    });
    sequelize.addHook('afterBulkDestroy', (options) => {
        const table = options.model?.tableName;
        if (!als.getStore() || !table || IGNORED_TABLES.has(table)) return;
        note({ action: 'bulk_destroy', table, where: trim(JSON.stringify(options.where), 200) });
    });
};

const describeChange = (change) => {
    const target = `${entityLabel(change.table)}${change.name ? ` «${change.name}»` : ''}${change.id ? ` (id ${change.id})` : ''}`;
    switch (change.action) {
        case 'create': return `creó ${target}`;
        case 'destroy': return `eliminó ${target}`;
        case 'bulk_destroy': return `eliminó registros de ${change.table}`;
        case 'bulk_update':
            return `modificó registros de ${change.table}: ${change.fields.map((f) => `${f.field} → «${f.to}»`).join(', ')}`;
        default:
            return `modificó ${target}: ${change.fields.map((f) => `${f.field} «${f.from}» → «${f.to}»`).join(', ')}`;
    }
};

const sanitizeBody = (body) => {
    if (!body || typeof body !== 'object') return null;
    const clean = (value, key) => {
        if (key && SENSITIVE.test(key)) return '(oculto)';
        if (Array.isArray(value)) return value.slice(0, 50).map((item) => clean(item));
        if (value && typeof value === 'object') {
            return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, clean(v, k)]));
        }
        return typeof value === 'string' ? trim(value, 500) : value;
    };
    const text = JSON.stringify(clean(body));
    return text.length > 4000 ? { truncado: trim(text, 4000) } : JSON.parse(text);
};

// Guarda una entrada del registro a nombre del superadmin REAL (la sesión ya es la del otro usuario, así que no se usa
// logEvent, que tomaría el nombre de `req.user`).
const writeEvent = ({ level = 'info', source, message, detail, req, statusCode = null, impersonator }) =>
    md.system_events
        .create({
            level,
            category: CATEGORY,
            source: trim(source, 120),
            message: trim(message, 2000),
            detail: detail ?? null,
            method: trim(req?.method, 10),
            path: trim(req?.originalUrl?.split('?')[0], 300),
            status_code: statusCode,
            user_id: impersonator.id,
            user_name: trim(impersonator.name, 150),
        })
        .catch((e) => console.error('[suplantacion] No se pudo registrar el evento:', e.message));

const logStart = (req, impersonator, target) => writeEvent({
    source: 'ingreso_como',
    message: `${impersonator.name} ingresó como ${target.nombre} (${target.usuario}, rol ${target.role?.rol ?? 'sin rol'})`,
    detail: { as: { id: target.id, nombre: target.nombre, usuario: target.usuario, rol: target.role?.rol ?? null }, ip: req.ip },
    req, impersonator,
});

const logExit = (req, impersonator, asName) => writeEvent({
    source: 'salida_como',
    message: `${impersonator.name} volvió a su cuenta (había ingresado como ${asName})`,
    req, impersonator,
});

const writeAudit = (req, res, store) => {
    const { impersonator, target, changes } = store;
    const failed = res.statusCode >= 400;
    const who = `${impersonator.name}, ingresado como ${target.nombre}`;
    const route = `${req.method} ${req.route?.path ?? req.originalUrl.split('?')[0]}`;
    const lines = changes.map(describeChange);
    let message;
    if (lines.length) {
        const shown = lines.slice(0, 3).join(' | ');
        message = `${who}: ${shown}${lines.length > 3 ? ` | (y ${lines.length - 3} cambios más)` : ''}`;
    } else {
        message = `${who} ejecutó ${route}`;
    }
    if (failed) message = `[falló con HTTP ${res.statusCode}, los cambios pueden no haberse guardado] ${message}`;
    writeEvent({
        level: failed ? 'warning' : 'info',
        source: route,
        message,
        detail: {
            as: { id: target.id, nombre: target.nombre },
            changes,
            body: sanitizeBody(req.body),
        },
        req, statusCode: res.statusCode, impersonator,
    });
};

// Middleware: si la sesión es de suplantación, valida que el superadmin real siga activo y abre el contexto de
// auditoría. En una sesión normal no hace nada.
const impersonationContext = async (req, res, next) => {
    const impersonator = req.session?.impersonator;
    if (!impersonator || !req.user) return next();
    try {
        const real = await md.usuarios.scope('withRole').findByPk(impersonator.id, { attributes: ['id', 'activo'] });
        if (!real?.activo || real.role?.rol !== 'superadmin') {
            return req.session.destroy(() => res.status(403).send({ message: 'Acceso denegado. Por favor inicie sesión' }));
        }
        const store = { impersonator, target: { id: req.user.id, nombre: req.user.nombre }, changes: [] };
        const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes(req.method);
        if (isWrite && !req.originalUrl.includes('/auth/impersonate')) {
            res.on('finish', () => writeAudit(req, res, store));
        }
        return als.run(store, next);
    } catch (error) {
        return next(error);
    }
};

module.exports = { CATEGORY, installAuditHooks, impersonationContext, logStart, logExit };
