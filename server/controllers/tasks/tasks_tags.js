const md = require('../../models');

const getAll = async (req, res) => {
    try {
        const tags = await md.tasks_tags.findAll({order: [['id', 'ASC']]});
        res.status(200).json(tags);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las etiquetas' + error.message });
    }
};

module.exports = {
    getAll,
};