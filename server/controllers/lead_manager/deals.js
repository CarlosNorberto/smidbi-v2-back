const md = require('../../models');

const getByStage = async (req, res) => {
    try {
        const { stage_id, page = 1, limit = 20 } = req.query;
        const { rows, count } = await md.prospect_history.findAndCountAll({
            where: { stage_id },
            include: [
                {
                    model: md.prospects,
                    as: 'prospect',
                    attributes: ['id', 'name'],
                },
                {
                    model: md.usuarios,
                    as: 'responsible',
                    attributes: ['id', 'nombre'],
                },
                {
                    model: md.customer_temperature,
                    as: 'temperature',
                    attributes: ['id', 'name'],
                },
                {
                    model: md.services,
                    as: 'services',
                    attributes: ['id', 'service', 'bgcolor', 'color'],
                    through: { attributes: [] }, // no traer columnas de la tabla puente
                },
            ],
            order: [['order', 'ASC']],
            offset: (page - 1) * limit,
            limit: parseInt(limit, 10),
        });
        res.status(200).json({ rows, count });
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

module.exports = {
    getByStage,
};
