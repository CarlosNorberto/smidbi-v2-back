const md = require('../../models');
const { Op } = require('sequelize');
const { getExpirationStatus } = require('../../helps');

const getAll = async (req, res,) => {
    try {
        const reportId = req.params.reportId;
        let whereCards = {};
        let whereResponsibles = {};
        let responsiblesRequired = false;
        if (reportId) {
            whereCards.report_id = reportId;
        }else{
            whereResponsibles.id = req.user.id;            
            responsiblesRequired = true;
            const daysToKeepCompleted = 7; // Mostrar completadas de últimos 7 días
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysToKeepCompleted);
            
            whereCards[Op.or] = [
                // Tareas no completadas
                { completed: false },
                // Tareas completadas recientemente
                {
                    completed: true,
                    date_completed: { [Op.gte]: cutoffDate }
                }
            ];
        }
        const tasksLists = await md.tasks_lists.findAll({
            include: [
                {
                    model: md.tasks_cards,
                    as: 'cards',
                    where: whereCards,
                    required: false,
                    include: [
                        {
                            model: md.usuarios,
                            as: 'responsibles',
                            where: whereResponsibles,
                            required: responsiblesRequired,
                            through: { attributes: [] },
                            attributes: ['id', 'nombre', 'email', 'time_zone'],
                        },
                        {
                            model: md.tasks_tags,
                            as: 'tags',
                            through: { attributes: [] },
                        },
                    ]
                },
            ],
            order: [['order', 'ASC'], [{ model: md.tasks_cards, as: 'cards' }, 'order', 'ASC']],
        });
        for (const list of tasksLists) {
            for (const card of list.cards) {
                if (card.exp_date_year && card.exp_date_month && card.exp_date_day) {
                    const expDate = new Date(card.exp_date_year, card.exp_date_month - 1, card.exp_date_day, card.exp_time_hour, card.exp_time_minute);
                    card.dataValues.expired_status = getExpirationStatus(card);
                    card.dataValues.expired_date = expDate;
                }
                else {
                    card.dataValues.expired_status = '';
                    card.dataValues.expired_date = null;
                }
            }
        }        
        res.status(200).json(tasksLists);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las listas de tareas' + error.message });
    }
};

module.exports = {
    getAll,
};