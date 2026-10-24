const md = require('../../models');

const getAll = async (req, res) => {
    try {
        const industries = await md.industries.findAll({
            where: { active: true },
            attributes: ['id', 'name'],
            order: [['name', 'ASC']],
        });
        res.status(200).json(industries);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
};

module.exports = { getAll };
