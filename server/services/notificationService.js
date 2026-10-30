const { Op } = require('sequelize');
const md = require('../models');

// Notificaciones de la campanita del grupo "Otros" (las tareas tienen su propio grupo).
//
//   notifyRoles(['admin', 'superadmin'], { type: 'ai_AI_NO_CREDIT', title: '...', body: '...', link: '/admin/...' })
//
// Si un usuario ya tiene un aviso SIN LEER del mismo `type`, no se crea otro (un fallo que se repite cada minuto no
// debe llenar la campanita). Nunca lanza error: avisar no puede romper el proceso que falló.
const RETENTION_DAYS = 30;

const notifyRoles = async (roles, { type, title, body = null, link = null }) => {
    try {
        const users = await md.users.findAll({
            where: { activo: true },
            attributes: ['id'],
            include: [{ model: md.roles, as: 'role', attributes: [], where: { rol: { [Op.in]: roles } }, required: true }],
        });
        if (users.length === 0) return;

        const ids = users.map((u) => u.id);
        const pending = await md.notifications.findAll({
            where: { type, read_at: null, user_id: { [Op.in]: ids } },
            attributes: ['user_id'],
        });
        const alreadyNotified = new Set(pending.map((n) => n.user_id));
        const rows = ids
            .filter((id) => !alreadyNotified.has(id))
            .map((user_id) => ({ user_id, type, title, body, link }));
        if (rows.length) await md.notifications.bulkCreate(rows);
    } catch (error) {
        console.error('[notifications] No se pudo crear la notificación:', error.message);
    }
};

// Borra las notificaciones leídas de más de RETENTION_DAYS días.
const purgeOldNotifications = async () => {
    try {
        const limit = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
        await md.notifications.destroy({ where: { read_at: { [Op.lt]: limit } } });
    } catch (error) {
        console.error('[notifications] No se pudo limpiar las notificaciones:', error.message);
    }
};

module.exports = { notifyRoles, purgeOldNotifications };
