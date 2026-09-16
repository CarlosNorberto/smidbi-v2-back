const { Op } = require('sequelize');
const md = require('../../models');
const { getUserFilter, isUnrestrictedRole } = require('../helps/helps');

// Empresas donde el usuario (rol 'user') tiene al menos un reporte asignado.
// Sin esto, la búsqueda de empresa por nombre (más abajo) es global: un rol
// restringido podría ver, en una lista de desambiguación, el nombre de
// empresas que no le corresponden (aunque después la consulta de reportes sí
// filtre por `id_usuario` y no le devuelva datos). Se usa solo para 'user' —
// admin/superadmin siguen viendo todas.
const getAccessibleCompanyIds = async (currentUser) => {
    const empresas = await md.empresas.findAll({
        attributes: ['id'],
        include: [{
            model: md.categorias, as: 'categorias', required: true, attributes: [],
            include: [{
                model: md.campanas, as: 'campanas', required: true, attributes: [],
                include: [{
                    model: md.reportes, as: 'reportes', required: true, attributes: [],
                    where: { id_usuario: currentUser.id },
                }],
            }],
        }],
    });
    return new Set(empresas.map((e) => e.id));
};

function formatDate(date) {
    if (!date) return 'N/A';
    const [year, month, day] = date.split('T')[0].split('-');
    return `${day}/${month}/${year}`;
}

// Patrón ILIKE tolerante: en vez de "%texto%" (que exige el texto completo
// como substring exacto), separa por palabras y arma "%palabra1%palabra2%...".
// Esto evita falsos "no encontrado" cuando el extractor de entidades (LLM)
// omite o reordena alguna preposición/artículo del nombre real, o cuando
// separa mal un nombre de campaña en dos campos (ver más abajo).
function buildFuzzyNamePattern(text) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    return `%${words.join('%')}%`;
}

const getCatalog = async (entities, needs, currentUser) => {
    try {
        let company = null;

        if (needs.includes('company') && entities.company_name) {
            let companies = await md.empresas.findAll({
                where: {
                    activo: true,
                    nombre: { [Op.iLike]: buildFuzzyNamePattern(entities.company_name) }
                },
                attributes: ['id', 'nombre']
            });

            // Para rol 'user' (restringido), se filtra a solo las empresas donde
            // tiene algún reporte asignado — así una lista de desambiguación
            // nunca revela el nombre de una empresa que no le corresponde.
            let restrictedMiss = false;
            if (companies.length > 0 && !isUnrestrictedRole(currentUser)) {
                const accessibleIds = await getAccessibleCompanyIds(currentUser);
                const filtered = companies.filter((c) => accessibleIds.has(c.id));
                restrictedMiss = filtered.length === 0;
                companies = filtered;
            }

            if (companies.length === 0) {
                if (restrictedMiss) {
                    return {
                        ambiguous: false,
                        company: null,
                        campaigns: [],
                        not_found: true,
                        not_found_type: 'company',
                        restricted: true
                    };
                }
                if (needs.includes('campaign')) {
                    // El extractor de entidades a veces separa mal el nombre de una
                    // campaña en dos campos cuando contiene alguna palabra que
                    // "suena" a nombre de empresa (ej. "Display Cluster de Sitios
                    // Web" -> company_name: "Sitios Web", campaign_name: "Display
                    // Cluster"). Como esa empresa no existe, se reintenta la
                    // búsqueda de campaña combinando ambos textos antes de
                    // rendirse.
                    entities.campaign_name = entities.campaign_name
                        ? `${entities.campaign_name} ${entities.company_name}`
                        : entities.company_name;
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
            // Si el intent necesita una empresa (client_summary, active_campaigns)
            // y no se pudo resolver ninguna -sea porque no coincidió el nombre,
            // o porque la pregunta nunca mencionó una empresa-, hay que pedir
            // aclaración en vez de seguir adelante: las tools de estos intents
            // arman su propio "where: { id: company_id }" y truenan si
            // company_id llega undefined.
            if (needs.includes('company') && !company) {
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
            if (entities.campaign_name) {
                // "campaign_name" en la pregunta del usuario puede referirse tanto
                // al nombre del reporte/anuncio (reportes.nombre) como al nombre
                // de la campaña real que lo agrupa (campanas.nombre) - para el
                // usuario ambos son "la campaña", así que se busca en los dos.
                const pattern = buildFuzzyNamePattern(entities.campaign_name);
                whereReport[Op.or] = [
                    { nombre: { [Op.iLike]: pattern } },
                    { '$campana.nombre$': { [Op.iLike]: pattern } }
                ];
            }
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