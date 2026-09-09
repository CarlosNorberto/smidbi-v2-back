const { Op } = require('sequelize');

const LEAD_MANAGER_SEARCH_FIELDS = {
    prospect: {
        association: 'prospect',
        column: 'name',
        type: 'text',
    },
    responsible: {
        // association: 'responsible',
        column: 'responsible_id',
        type: 'select',
    },
    temperature: {
        // association: 'temperature',
        column: 'customer_temperature_id',
        type: 'select',
    },
    date: {
        column: 'date',
        type: 'daterange',
    },
    stage: {
        // association: 'stage',
        column: 'stage_id',
        type: 'select',
    },    
};

const parseFilters = (raw) => {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
};

/**
 * Construye los filtros cuando se reciben desde el front-end
 * @param {Array} filters - Filtros recibidos desde el front-end
 * @param {Object} fieldMap - Mapa de campos del módulo
 * @returns {Object} Filtros construidos
 */
const buildFilters = (filters, fieldMap) => {
    const mainWhere = {};
    const includeWhere = {};

    for (const { field, value } of filters) {
        const cfg = fieldMap[field];
        if (!cfg || value == null || value === '') continue;

        let condition;

        if (cfg.type === 'text') {
            condition = { [Op.iLike]: `%${value}%` };
        } else if (cfg.type === 'daterange') {
            // value viene como { from: '2026-06-01', to: '2026-07-31' }
            if (value.from && value.to) {
                condition = { [Op.between]: [value.from, value.to] };
            } else if (value.from) {
                condition = { [Op.gte]: value.from };
            } else if (value.to) {
                condition = { [Op.lte]: value.to };
            } else {
                continue; // rango vacío, salta este filtro
            }
        } else {
            condition = value; // select u otros: igualdad directa
        }

        if (cfg.association) {
            includeWhere[cfg.association] = {
                ...(includeWhere[cfg.association] || {}),
                [cfg.column]: condition,
            };
        } else {
            mainWhere[cfg.column] = condition;
        }
    }

    return { mainWhere, includeWhere };
};

module.exports = {
    parseFilters,
    buildFilters,
    LEAD_MANAGER_SEARCH_FIELDS,
};
