const md = require('../../models');

const getAll = async (req, res) => {
    try {
        const statuses = await md.status.findAll();
        res.status(200).json(statuses);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

const saveUpdate = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: 'Datos no proporcionados' });
        }
        const { id, state, bgcolor, color, description } = req.body;
        if (!state) {
            return res.status(400).json({ error: 'El campo "state" es obligatorio' });
        }
        const [status] = await md.status.upsert({
            id  ,
            state,
            bgcolor,
            color,
            description
        }, { returning: true, conflictFields: ['state'] });
        res.status(id ? 200 : 201).json(status);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

module.exports = {
    getAll,
    saveUpdate
};