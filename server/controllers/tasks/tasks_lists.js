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
                            model: md.tasks_tags,
                            as: 'tags',
                            through: { attributes: [] },
                        },
                        {
                            model: md.tasks_card_responsibles,
                            as: 'responsibles',
                            through: { attributes: [] },
                            include: [
                                {
                                    model: md.usuarios,
                                    as: 'usuario',
                                    attributes: ['id', 'nombre', 'email', 'time_zone'],
                                }
                            ]
                        }
                    ]
                },
            ],
            order: [['order', 'ASC'], [{ model: md.tasks_cards, as: 'cards' }, 'order', 'ASC']],
        });
        res.status(200).json(tasksLists);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las listas de tareas' });
    }
};

module.exports = {
    getAllByReportId,
};