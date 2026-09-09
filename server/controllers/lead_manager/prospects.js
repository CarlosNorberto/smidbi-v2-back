const md = require('../../models');

const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 10, showAll="false" } = req.query;
        const shouldShowAll = showAll === "true";
        const prospects = await md.prospects.findAll({
            offset: shouldShowAll ? undefined : (page - 1) * limit,
            limit: shouldShowAll ? undefined : parseInt(limit, 10)
        });
        res.status(200).json(prospects);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

const create = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: 'Datos no proporcionados' });
        }
        const { id, country, city, name, position, email, phone, web_page, client } = req.body;
        if (!name) {
            return res.status(400).json({ error: 'El campo "name" es obligatorio' });
        }
        const prospect = await md.prospects.create({
            id,
            country,
            city,
            name,
            position,
            email,
            phone,
            web_page,
            client
        });
        res.status(id ? 200 : 201).json(prospect);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

const update = async (req, res) => {
    try {
        const { id } = req.params;
        if (!id) {
            return res.status(400).json({ error: 'ID del prospecto no proporcionado' });
        }
        const { country, city, name, position, email, phone, web_page, client } = req.body;
        const prospect = await md.prospects.findOne({ where: { id } });
        if (!prospect) {
            return res.status(404).json({ error: 'Prospecto no encontrado' });
        }
        if (!name) {
            return res.status(400).json({ error: 'El campo "name" es obligatorio' });
        }
        await prospect.update(
            { country, city, name, position, email, phone, web_page, client }
        );
        res.status(200).json(prospect);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

module.exports = {
    getAll,
    create,
    update
};