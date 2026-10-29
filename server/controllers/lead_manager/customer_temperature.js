const md = require('../../models');

const getAll = async (req, res) => {
    try {
        const temperatures = await md.customer_temperature.findAll({
            order: [['sort_order', 'ASC'], ['id', 'ASC']],
        });
        res.status(200).json(temperatures);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

const create = async (req, res) => {
    try {
        const name = (req.body.name || '').trim();
        const description = req.body.description || null;
        const icon = (req.body.icon || '').trim().slice(0, 16) || null;
        if (!name) {
            return res.status(400).json({ error: 'name es requerido' });
        }
        const maxSortOrder = await md.customer_temperature.max('sort_order');
        const temperature = await md.customer_temperature.create({
            name,
            description,
            icon,
            sort_order: (maxSortOrder || 0) + 1,
        });
        res.status(201).json(temperature);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const temperature = await md.customer_temperature.findByPk(id);
        if (!temperature) {
            return res.status(404).json({ error: 'Temperatura no encontrada' });
        }
        const name = (req.body.name || '').trim();
        if (!name) {
            return res.status(400).json({ error: 'name es requerido' });
        }
        await temperature.update({
            name,
            description: req.body.description || null,
            icon: (req.body.icon || '').trim().slice(0, 16) || null,
        });
        res.json(temperature);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

const reorder = async (req, res) => {
    try {
        const { orderedIds } = req.body;
        if (!Array.isArray(orderedIds)) {
            return res.status(400).json({ error: 'orderedIds requerido' });
        }
        await md.sequelize.transaction(async (t) => {
            await Promise.all(orderedIds.map((id, i) =>
                md.customer_temperature.update({ sort_order: i }, { where: { id }, transaction: t })
            ));
        });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

// Una temperatura en uso no se borra (la FK de prospect_history lo impediría y se perdería el dato).
const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const temperature = await md.customer_temperature.findByPk(id);
        if (!temperature) {
            return res.status(404).json({ error: 'Temperatura no encontrada' });
        }
        const inUse = await md.prospect_history.count({ where: { customer_temperature_id: id } });
        if (inUse > 0) {
            return res.status(409).json({
                error: `No se puede eliminar: ${inUse} oportunidad(es) usan esta temperatura.`,
            });
        }
        await temperature.destroy();
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

module.exports = {
    getAll,
    create,
    update,
    reorder,
    remove,
};
