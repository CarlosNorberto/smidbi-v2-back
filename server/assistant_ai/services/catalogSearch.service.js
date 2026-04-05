const { Op } = require('sequelize');
const md = require('../../models');
const { getUserFilter } = require('../helps/helps');

function formatDate(date) {
    if (!date) return 'N/A';
    const [year, month, day] = date.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
}

const getCatalog = async (entities, needs, currentUser) => {
    try {
        let company = null;

        if (needs.includes('company') && entities.company_name) {
            const companies = await md.empresas.findAll({
                where: {
                    activo: true,
                    nombre: { [Op.iLike]: `%${entities.company_name}%` }
                },
                attributes: ['id', 'nombre']
            });

            if (companies.length === 0) {
                if (!entities.campaign_name && needs.includes('campaign')) {
                    entities.campaign_name = entities.company_name;
                    entities.company_name = null;
                } else {
                    return {
                        ambiguous: false,
                        company: null,
                        campaigns: [],
                        not_found: true,
                        not_found_type: 'company'
                    };
                }
            } else if (companies.length > 1) {
                return {
                    ambiguous: true,
                    ambiguous_type: 'company',
                    options: companies.map(c => ({
                        id: c.id, label: c.nombre, type: 'company'
                    }))
                };
            } else {
                company = companies[0];
            }
        }

        if (!needs.includes('campaign')) {
            if (needs.includes('company') && !company && entities.company_name) {
                return {
                    ambiguous: false,
                    company: null,
                    campaigns: [],
                    not_found: true,
                    not_found_type: 'company'
                };
            }
            return { ambiguous: false, company, campaigns: [] };
        }

        // ── Función interna reutilizable ──
        const fetchReports = async (includeInactive = false) => {
            const whereReport = includeInactive ? {} : { activo: true };
            Object.assign(whereReport, getUserFilter(currentUser));
            const whereCampaign = {};
            const whereCompany = { activo: true };
            const wherePlatform = {};

            if (company) whereCompany.id = company.id;
            if (entities.campaign_name) whereReport.nombre = { [Op.iLike]: `%${entities.campaign_name}%` };
            if (entities.platform) wherePlatform.plataforma = { [Op.iLike]: `%${entities.platform}%` };
            if (entities.year) {
                whereReport.fecha_ini = {
                    [Op.between]: [`${entities.year}-01-01`, `${entities.year}-12-31`]
                };
            }

            return md.reportes.findAll({
                where: whereReport,
                attributes: ['id', 'nombre', 'id_campana', 'fecha_ini', 'fecha_fin', 'activo'],
                order: [[md.sequelize.literal('fecha_ini DESC NULLS LAST')]],
                include: [
                    {
                        model: md.campanas,
                        as: 'campana',
                        required: true,
                        where: Object.keys(whereCampaign).length ? whereCampaign : undefined,
                        attributes: ['id', 'nombre'],
                        include: [
                            {
                                model: md.categorias,
                                as: 'categoria',
                                required: true,
                                attributes: ['id', 'nombre'],
                                include: [
                                    {
                                        model: md.empresas,
                                        as: 'empresa',
                                        required: true,
                                        where: whereCompany,
                                        attributes: ['id', 'nombre']
                                    }
                                ]
                            }
                        ]
                    },
                    {
                        model: md.plataformas,
                        as: 'plataforma',
                        where: wherePlatform,
                        attributes: ['id', 'plataforma']
                    }
                ]
            });
        };

        // ── Buscar activas primero, si no hay buscar inactivas ──
        let reports = await fetchReports(false);

        if (reports.length === 0) {
            reports = await fetchReports(true);
            if (reports.length > 0) {
                return buildResult(reports, company, true);
            }
            return {
                ambiguous: false,
                company,
                campaigns: [],
                not_found: true,
                not_found_type: 'campaign'
            };
        }

        return buildResult(reports, company, false);

    } catch (error) {
        console.error('Error in getCatalog:', error);
        throw new Error('Error fetching catalog');
    }
};

const buildResult = (reports, company, includeInactive) => {
    if (reports.length > 1) {
        return {
            ambiguous: true,
            ambiguous_type: 'campaign',
            include_inactive: includeInactive,
            company,
            options: reports.map(r => ({
                id: r.id,
                label: r.nombre,
                detail: `Co.: ${r.campana?.categoria?.empresa?.nombre} › Cat.: ${r.campana?.categoria?.nombre} › Camp.: ${r.campana?.nombre}`,
                period: r.fecha_ini && r.fecha_fin
                    ? `${formatDate(r.fecha_ini)} - ${formatDate(r.fecha_fin)}`
                    : 'No period',
                type: 'report'
            }))
        };
    }
    return {
        ambiguous: false,
        company,
        campaigns: reports,
        include_inactive: includeInactive
    };
};

module.exports = getCatalog;