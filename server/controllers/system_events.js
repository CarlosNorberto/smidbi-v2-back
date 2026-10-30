const { Op } = require('sequelize');
const md = require('../models');
const { CATEGORIES } = require('../services/systemEventService');

// Registro de errores del sistema (Configuraciones > Registro de errores). Solo superadmin (ver routes/index.js).
// Filtros opcionales: category, level, from / to (YYYY-MM-DD, hora de Bolivia) y search (texto en mensaje, origen o ruta).
const getAll = async (req, res) => {
    try {
        const { category, level, from, to, search } = req.query;
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);

        const where = {};
        if (category) where.category = category;
        if (level) where.level = level;
        if (/^\d{4}-\d{2}-\d{2}$/.test(from || '') || /^\d{4}-\d{2}-\d{2}$/.test(to || '')) {
            where.created_at = {};
            if (/^\d{4}-\d{2}-\d{2}$/.test(from || '')) where.created_at[Op.gte] = new Date(`${from}T00:00:00`);
            if (/^\d{4}-\d{2}-\d{2}$/.test(to || '')) where.created_at[Op.lte] = new Date(`${to}T23:59:59.999`);
        }
        if (search?.trim()) {
            const like = { [Op.iLike]: `%${search.trim()}%` };
            where[Op.or] = [{ message: like }, { source: like }, { path: like }, { user_name: like }];
        }

        const { rows, count } = await md.system_events.findAndCountAll({
            where,
            order: [['created_at', 'DESC'], ['id', 'DESC']],
            limit,
            offset: (page - 1) * limit,
        });
        res.status(200).json({ rows, count });
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el registro de errores: ${error.message}` });
    }
};

const getCategories = (req, res) =>
    res.status(200).json(Object.entries(CATEGORIES).map(([value, label]) => ({ value, label })));

module.exports = { getAll, getCategories };
