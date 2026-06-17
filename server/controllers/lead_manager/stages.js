const md = require('../../models');

const getAll = async (req, res) => {
    try {
        const stages = await md.stages.findAll({
            where: { is_active: true },
            order: [['sort_order', 'ASC']],
        });
        res.status(200).json(stages);
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

module.exports = {
    getAll,    
};
