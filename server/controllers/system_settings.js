const md = require('../models');

const getAll = async (req, res) => {
    try {
        const { module } = req.query;
        const where = {};
        if (module) where.module = module;
        const settings = await md.system_settings.findAll({
            where,
            order: [['module', 'ASC'], ['key', 'ASC']],
        });
        res.json(settings);
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const setting = await md.system_settings.findByPk(id);
        if (!setting) {
            return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        res.json(setting);
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const create = async (req, res) => {
    try {
        const { module, key, value, description, active } = req.body;
        if (!module || !key || value === undefined) {
            return res
                .status(400)
                .json({ error: 'module, key y value son requeridos' });
        }
        const newSetting = await md.system_settings.create({
            module,
            key,
            value,
            description,
            active: active ?? true,
        });
        res.status(201).json(newSetting);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res
                .status(409)
                .json({ error: 'Ya existe una configuración con ese module y key' });
        }
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const setting = await md.system_settings.findByPk(id);
        if (!setting) {
            return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        const { module, key, value, description, active } = req.body;
        const payload = { updated_at: new Date() };
        if (module !== undefined) payload.module = module;
        if (key !== undefined) payload.key = key;
        if (value !== undefined) payload.value = value;
        if (description !== undefined) payload.description = description;
        if (active !== undefined) payload.active = active;
        await setting.update(payload);
        res.json(setting);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res
                .status(409)
                .json({ error: 'Ya existe una configuración con ese module y key' });
        }
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const setting = await md.system_settings.findByPk(id);
        if (!setting) {
            return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        await setting.destroy();
        res.json({ message: 'Configuración eliminada correctamente' });
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

module.exports = {
    getAll,
    getById,
    create,
    update,
    remove,
};
