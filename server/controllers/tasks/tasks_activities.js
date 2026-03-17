const md = require('../../models');

const getAllByCardId = async (req, res) => {
    try {
        const card_id = req.params.card_id;
        const activities = await md.tasks_activities.findAll({
            where: { card_id },
            order: [['date_activity', 'DESC']],
            include: [
                {
                    model: md.usuarios,
                    as: 'usuario',
                    attributes: ['id', 'nombre']
                }
            ]
        });
        res.status(200).json(activities);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las actividades de la tarjeta: ${error.message}` });
    }
};

module.exports = {
    getAllByCardId
};