const md = require('../models');

// Notificaciones "Otros" del usuario conectado (campanita). Solo las no leídas, las más recientes primero.
const getMine = async (req, res) => {
    try {
        const notifications = await md.notifications.findAll({
            where: { user_id: req.user.id, read_at: null },
            order: [['created_at', 'DESC'], ['id', 'DESC']],
            limit: 50,
        });
        res.status(200).json(notifications);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las notificaciones' });
    }
};

const markAsRead = async (req, res) => {
    try {
        await md.notifications.update(
            { read_at: new Date() },
            { where: { id: req.params.id, user_id: req.user.id, read_at: null } },
        );
        res.status(200).json({ message: 'Notificación marcada como leída' });
    } catch (error) {
        res.status(500).json({ message: 'Error al marcar la notificación como leída' });
    }
};

const markAllAsRead = async (req, res) => {
    try {
        await md.notifications.update({ read_at: new Date() }, { where: { user_id: req.user.id, read_at: null } });
        res.status(200).json({ message: 'Notificaciones marcadas como leídas' });
    } catch (error) {
        res.status(500).json({ message: 'Error al marcar las notificaciones como leídas' });
    }
};

module.exports = { getMine, markAsRead, markAllAsRead };
