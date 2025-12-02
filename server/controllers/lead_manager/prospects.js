const md = require('../../models');

const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const prospects = await md.prospects.findAll({
            offset: (page - 1) * limit,
            limit: parseInt(limit, 10)
        });
        res.status(200).json(prospects);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

const saveUpdate = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: 'Datos no proporcionados' });
        }
        const { id, country, city, name, position, email, phone, web_page, client } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'El campo "name" es obligatorio' });
        }
        const [prospect] = await md.prospects.upsert({
            id,
            country,
            city,
            name,
            position,
            email,
            phone,
            web_page,
            client
        }, { returning: true });
        res.status(id ? 200 : 201).json(prospect);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

module.exports = {
    getAll,
    saveUpdate
};