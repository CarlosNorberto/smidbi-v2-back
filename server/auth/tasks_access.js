// Acceso a las tareas (tablero de un reporte y sus tarjetas).
//
// Antes cualquier usuario con sesión podía leer y modificar las tareas de CUALQUIER reporte con solo conocer su id. Ahora:
//   - Admin y superadmin: todo (como siempre).
//   - Quien gestiona el reporte (`canManageReport`: responsable del reporte o de su empresa).
//   - Quien tiene asignada una tarea (responsable de la tarjeta): puede abrir esa tarjeta, y el tablero de su reporte (es lo que
//     abre el aviso de WhatsApp y la campanita de "tareas asignadas a mí").
// Para todo lo demás se responde 404 (`denyAccess`) y no 403: el interceptor de axios del frontend manda al login ante un 403.

const md = require('../models');
const { isUnrestricted, canManageReport, denyAccess } = require('./ownership');

// ¿Tiene el usuario asignada alguna tarjeta (de ese reporte, o esa tarjeta en concreto)?
const isAssigned = async (user, { reportId, cardId }) => {
    const rows = await md.tasks_card_responsibles.findAll({
        where: { responsible_id: user.id, ...(cardId ? { card_id: cardId } : {}) },
        attributes: ['card_id'],
        raw: true,
    });
    if (!rows.length) return false;
    if (cardId) return true;
    const count = await md.tasks_cards.count({ where: { id: rows.map((r) => r.card_id), report_id: reportId } });
    return count > 0;
};

const canAccessReportTasks = async (user, reportId) => {
    if (isUnrestricted(user)) return true;
    if (!reportId) return false;
    if (await canManageReport(user, reportId)) return true;
    return isAssigned(user, { reportId });
};

const canAccessCard = async (user, cardId) => {
    if (isUnrestricted(user)) return true;
    if (!cardId) return false;
    const card = await md.tasks_cards.findByPk(cardId, { attributes: ['id', 'report_id', 'user_id'], raw: true });
    if (!card) return true; // no existe: que el controlador responda su propio 404
    if (card.report_id && (await canManageReport(user, card.report_id))) return true;
    if (card.user_id === user.id) return true; // la creó él
    return isAssigned(user, { cardId: card.id });
};

const wrap = (check) => async (req, res, next) => {
    try {
        if (await check(req)) return next();
        return denyAccess(res);
    } catch (error) {
        return res.status(500).json({ message: `No se pudo validar el acceso a las tareas: ${error.message}` });
    }
};

// Middlewares para las rutas de /tasks_*
module.exports = {
    // :reportId (tablero de un reporte); sin reportId (tablero "mis tareas") no aplica: el controlador ya filtra por responsable.
    reportTasksAccess: wrap((req) => (req.params.reportId ? canAccessReportTasks(req.user, req.params.reportId) : true)),
    // crear una tarjeta: viene en el cuerpo (`report_id`)
    newCardAccess: wrap((req) => canAccessReportTasks(req.user, req.body?.report_id)),
    // :id, :card_id o body.card_id
    cardAccess: wrap((req) => canAccessCard(req.user, req.params.id || req.params.card_id || req.body?.card_id)),
    canAccessReportTasks,
    canAccessCard,
};
