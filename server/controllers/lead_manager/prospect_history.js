const { buildFilters, LEAD_MANAGER_SEARCH_FIELDS, parseFilters } = require('../../helps/search');
const md = require('../../models');

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const prospectHistory = await md.prospect_history.findOne({
            where: { id },
            include: [
                {
                    model: md.prospects,
                    as: 'prospect',
                    attributes: ['id', 'name', 'email', 'phone'],
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
        });
        if (!prospectHistory) {
            return res
                .status(404)
                .json({ error: 'Historial de prospecto no encontrado' });
        }
        res.json(prospectHistory);
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const filters = parseFilters(req.query.filters);
        const { mainWhere, includeWhere } = buildFilters(filters, LEAD_MANAGER_SEARCH_FIELDS);
        
        const offset = (page - 1) * limit;
        const prospectHistories = await md.prospect_history.findAndCountAll({
            where: mainWhere,
            include: [
                {
                    model: md.prospects,
                    as: 'prospect',
                    attributes: ['id', 'name', 'email', 'phone'],
                    where: includeWhere.prospect || {},
                    required: !!includeWhere.prospect,
                },
                {
                    model: md.responsibles,
                    as: 'responsible',
                    attributes: ['id', 'responsible'],
                    where: includeWhere.responsible || {},
                    required: !!includeWhere.responsible,
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
                    where: includeWhere.temperature || {},
                    required: !!includeWhere.temperature,
                },
                {
                    model: md.services,
                    as: 'services',
                    attributes: ['id', 'service', 'bgcolor', 'color'],
                    through: { attributes: [] }, // no traer columnas de la tabla puente
                },
                {
                    model: md.stages,
                    as: 'stage',                    
                    attributes: ['id', 'name', 'kind', 'color'],
                }
            ],
            limit,
            offset,
            order: [['id', 'DESC'],['date', 'DESC']],
            distinct: true,
        });
        res.json({
            total: prospectHistories.count,
            pages: Math.ceil(prospectHistories.count / limit),
            currentPage: parseInt(page),
            data: prospectHistories.rows,
        });
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const create = async (req, res) => {
    try {
        const { prospect_id, stage_id, name, email, phone } = req.body;
        if (!prospect_id || !stage_id) {
            return res
                .status(400)
                .json({ error: 'prospect_id y stage_id son requeridos' });
        }
        let newProspectHistory = null;
        if (prospect_id) {
            const prospect = await md.prospects.findOne({
                where: { id: prospect_id },
            });
            if (!prospect) {
                return res
                    .status(404)
                    .json({ error: 'Prospecto no encontrado' });
            }
            await prospect.update({ email, phone });
            // Crear un nuevo registro en prospect_history
            newProspectHistory = await md.prospect_history.create({
                prospect_id,
                stage_id,
                date: md.sequelize.literal('CURRENT_DATE'),
            });
        } else {
            if (!name) {
                return res
                    .status(400)
                    .json({
                        error: 'El campo "name" es obligatorio para crear un nuevo prospecto',
                    });
            }
            // Crear un nuevo prospecto
            const newProspect = await md.prospects.create({
                name,
                email,
                phone,                
            });
            // Crear un nuevo registro en prospect_history para el nuevo prospecto
            newProspectHistory = await md.prospect_history.create({
                prospect_id: newProspect.id,
                stage_id,
                date: md.sequelize.literal('CURRENT_DATE'),
            });
        }
        // ADD INCLUDES TO RESPONSE
        newProspectHistory = await md.prospect_history.findOne({
            where: { id: newProspectHistory.id },
            include: [
                {
                    model: md.prospects,
                    as: 'prospect',
                    attributes: ['id', 'name', 'email', 'phone'],
                },
                {
                    model: md.responsibles,
                    as: 'responsible',
                    attributes: ['id', 'responsible'],
                },                
            ],
        });
        res.status(201).json(newProspectHistory);
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { prospect_id, stage_id, responsible_id, final_state_id, customer_temperature_id, last_contact, observations, fuente_medio, service_ids, email, phone } = req.body;
        const prospectHistory = await md.prospect_history.findByPk(id);
        if (!prospectHistory) {
            return res.status(404).json({ error: 'Historial de prospecto no encontrado' });
        }
        if (prospect_id && (email || phone)) {
            const prospect = await md.prospects.findByPk(prospect_id);
            if (prospect) {
                await prospect.update({ email, phone });
            }
        }
        await prospectHistory.update({ prospect_id, stage_id, responsible_id, final_state_id, customer_temperature_id, last_contact, observations, fuente_medio });
        if (service_ids) {
            await md.prospect_history_services.destroy({ where: { prospect_history_id: id } });
            const serviceAssociations = service_ids.map(service_id => ({
                prospect_history_id: id,
                service_id,
            }));
            await md.prospect_history_services.bulkCreate(serviceAssociations);
        }
        // ADD INCLUDES TO RESPONSE
        const updatedProspectHistory = await md.prospect_history.findOne({
            where: { id: id },
            include: [
                {
                    model: md.prospects,
                    as: 'prospect',
                    attributes: ['id', 'name'],
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
        });
        res.status(200).json(updatedProspectHistory);
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const prospectHistory = await md.prospect_history.findByPk(id);
        if (!prospectHistory) {
            return res.status(404).json({ error: 'Historial de prospecto no encontrado' });
        }
        await prospectHistory.destroy();
        res.status(200).json({ message: 'Historial de prospecto eliminado correctamente' });
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

module.exports = {
    getById,
    getAll,
    create,
    update,
    remove
};
