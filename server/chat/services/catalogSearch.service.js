const { Op } = require('sequelize');
const md = require('../../models');

function formatDate(date) {
    if (!date) return 'N/A';
    const [year, month, day] = date.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
}

const getCatalog = async (entities, needs) => {
    try {
        let company = null;

        // ── Search company only if needed and mentioned ──
        if (needs.includes('company') && entities.company_name) {
            const companies = await md.empresas.findAll({
                where: {
                    activo: true,
                    nombre: { [Op.iLike]: `%${entities.company_name}%` }
                },
                attributes: ['id', 'nombre']
            });

            if (companies.length === 0) {
                if (!entities.campaign_name) {
                    return {
                        ambiguous: false,
                        company: null,
                        campaigns: [],
                        not_found: true,
                        not_found_type: 'company'
                    };
                }
                // Has campaign_name, continue without company
            } else if (companies.length > 1) {
                return {
                    ambiguous: true,
                    ambiguous_type: 'company',
                    options: companies.map(c => ({
                        id: c.id,
                        label: c.nombre,
                        type: 'company'
                    }))
                };
            } else {
                company = companies[0];
            }
        }

        // ── Return early if campaigns not needed ──
        if (!needs.includes('campaign')) {
            return { ambiguous: false, company, campaigns: [] };
        }

        // ── Build filters ──
        const whereReport = { activo: true };
        const whereCampaign = {};
        const whereCompany = { activo: true };

        if (company) {
            whereCompany.id = company.id;
        }
        if (entities.campaign_name) {
            whereReport.nombre = { [Op.iLike]: `%${entities.campaign_name}%` };
        }
        if (entities.platform) {
            whereCampaign.plataforma = { [Op.iLike]: `%${entities.platform}%` };
        }
        if (entities.year) {
            whereReport.fecha_ini = {
                [Op.between]: [`${entities.year}-01-01`, `${entities.year}-12-31`]
            };
        }

        // ── Main query ──
        const reports = await md.reportes.findAll({
            where: whereReport,
            attributes: ['id', 'nombre', 'id_campana', 'fecha_ini', 'fecha_fin'],
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
                }
            ]
        });

        if (reports.length === 0) {
            return {
                ambiguous: false,
                company,
                campaigns: [],
                not_found: true,
                not_found_type: 'campaign'
            };
        }

        if (reports.length > 1) {
            return {
                ambiguous: true,
                ambiguous_type: 'campaign',
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

        return { ambiguous: false, company, campaigns: reports };

    } catch (error) {
        console.error('Error in getCatalog:', error);
        throw new Error('Error fetching catalog');
    }
};

module.exports = getCatalog;