const md = require('../../models');
const { buildFilters, LEAD_MANAGER_SEARCH_FIELDS, parseFilters } = require('../../helps/search');

const getByStage = async (req, res) => {
    try {
        const { stage_id, page = 1, limit = 20 } = req.query;
        const filters = parseFilters(req.query.filters);        
        const { mainWhere, includeWhere } = buildFilters(filters, LEAD_MANAGER_SEARCH_FIELDS);
        console.log('filters:', mainWhere, includeWhere);

        const { rows, count } = await md.prospect_history.findAndCountAll({
            where: { stage_id, ...mainWhere },
            include: [
                {
                    model: md.prospects,
                    as: 'prospect',
                    attributes: ['id', 'name'],
                    where: includeWhere.prospect,
                    required: !!includeWhere.prospect,
                },
                {
                    model: md.responsibles,
                    as: 'responsible',
                    attributes: ['id', 'responsible'],                    
                },
                {
                    model: md.status,
                    as: 'final_state',
                    attributes: ['id', 'state', 'bgcolor', 'description'],
                },
                {
                    model: md.customer_temperature,
                    as: 'temperature',
                    attributes: ['id', 'name'],
                },
                {
                    model: md.services,
                    as: 'services',
                    attributes: ['id', 'service', 'bgcolor', 'color'],
                    through: { attributes: [] }, // no traer columnas de la tabla puente
                },
            ],
            order: [['order', 'ASC']],
            offset: (page - 1) * limit,
            limit: parseInt(limit, 10),
        });
        res.status(200).json({ rows, count });
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const reorder = async (req, res) => {
    const { stageId, orderedIds } = req.body || {};
    if (stageId == null || !Array.isArray(orderedIds)) {
        return res
            .status(400)
            .json({ error: 'stageId y orderedIds son requeridos' });
    }
    const t = await md.sequelize.transaction();
    try {
        await Promise.all(
            orderedIds.map((id, index) =>
                md.prospect_history.update(
                    { stage_id: stageId, order: index },
                    { where: { id }, transaction: t },
                ),
            ),
        );
        await t.commit();
        res.status(200).json({ ok: true });
    } catch (error) {
        await t.rollback();
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

module.exports = {
    getByStage,
    reorder,
};
