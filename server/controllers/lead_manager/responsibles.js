const md = require('../../models');

const getAll = async (req, res) => {
    try {
        const responsibles = await md.responsibles.findAll();
        res.status(200).json(responsibles);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

module.exports = {
    getAll
};