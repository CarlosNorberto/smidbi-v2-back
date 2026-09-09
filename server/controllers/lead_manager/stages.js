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

const reorder = async (req, res) => {
    try {
        const { orderedIds } = req.body;        
        if (!Array.isArray(orderedIds)){
            console.error('orderedIds no es un array:', orderedIds);
            return res.status(400).json({ error: 'orderedIds requerido' });
        }
        await md.sequelize.transaction(async (t) => {
            await Promise.all(orderedIds.map((id, i) =>
                md.stages.update({ sort_order: i }, { where: { id }, transaction: t })
            ));
        });
        res.json({ ok: true });
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const create = async (req, res) => {
    try {
        const { name, color, kind, is_active = true } = req.body;
        if (!name || !kind) {
            return res.status(400).json({ error: 'name y kind son requeridos' });
        }
        const maxSortOrder = await md.stages.max('sort_order');
        const newStage = await md.stages.create({
            name,
            color,
            kind,
            sort_order: (maxSortOrder || 0) + 1,
            is_active,
        });
        res.status(201).json(newStage);
    }
    catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, color, kind, is_active } = req.body;
        const stage = await md.stages.findByPk(id);
        if (!stage) {
            return res.status(404).json({ error: 'Etapa no encontrada' });
        }
        await stage.update({ name, color, kind, is_active });
        res.json(stage);
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

module.exports = {
    getAll,
    reorder,
    update,
    create,
};
