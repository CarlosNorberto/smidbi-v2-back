const md = require('../../models');

const getAllByReportId = async (req, res,) => {
    try {
        const reportId = req.params.reportId;
        const tasksLists = await md.tasks_lists.findAll({
            include: [
                {
                    model: md.tasks_cards,
                    as: 'cards',
                    where: { report_id: reportId },
                    required: false,
                    include: [
                        {
                            model: md.usuarios,
                            as: 'responsibles',
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
        const currentDate = new Date();
        tasksLists.forEach(list => {
            list.cards.forEach(card => {
                const expDate = new Date(card.exp_date_year, card.exp_date_month - 1, card.exp_date_day, card.exp_time_hour, card.exp_time_minute);
                card.dataValues.expired_message = expDate < currentDate ? 'Plazo vencido' : 'Vigente';
            });
        });
        res.status(200).json(tasksLists);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las listas de tareas' + error.message });
    }
};

module.exports = {
    getAllByReportId,
};