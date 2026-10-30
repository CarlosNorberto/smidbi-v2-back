
const md = require('../models');
const { Op } = require('sequelize');
const Sequelize = require('sequelize');
const { isUnrestricted } = require('../auth/ownership');

/**
 * Condición de búsqueda por nombre (insensible a mayúsculas y a espacios),
 * usada tanto por campaignSearch como por campaignSearchFilters.
 * @param {string} q - término de búsqueda (ya validado con longitud >= 2)
 * @param {string} column - columna a comparar, ej. 'reportes.nombre'
 */
const buildNameCondition = (q, column) => {
    const normalized = q.replace(/\s+/g, '');
    return Sequelize.where(
        Sequelize.fn('REPLACE', Sequelize.col(column), ' ', ''),
        { [Op.iLike]: `%${normalized}%` }
    );
};

/**
 * Condición para reportes cuyo fecha_ini o fecha_fin caen en el año dado.
 */
const buildYearCondition = (year) => ({
    [Op.or]: [
        Sequelize.where(Sequelize.fn('EXTRACT', Sequelize.literal('YEAR FROM "fecha_ini"')), year),
        Sequelize.where(Sequelize.fn('EXTRACT', Sequelize.literal('YEAR FROM "fecha_fin"')), year),
    ]
});

/**
 * Qué reportes puede ver en el buscador un usuario que NO es admin/superadmin: los de las empresas de las que es
 * responsable (un reporte pertenece al dueño de su empresa, aunque por datos anteriores a esa regla figure
 * asignado a otro usuario) y, además, los que tiene asignados directamente (`reportes.id_usuario`) — así el buscador
 * muestra lo mismo que puede abrir y editar (ver canManageReport en auth/ownership.js).
 * Devuelve null para admin/superadmin: ven todo, sin condición.
 * El id va como número dentro del SQL (Number() evita cualquier texto raro); no hay entrada del usuario en la consulta.
 */
const buildReportVisibility = (user) => {
    if (isUnrestricted(user)) return null;
    const userId = Number(user.id);
    return {
        [Op.or]: [
            { id_usuario: userId },
            {
                id_campana: {
                    [Op.in]: Sequelize.literal(
                        `(SELECT ca.id FROM campanas ca
                            JOIN categorias c ON c.id = ca.id_categoria
                            JOIN empresas e ON e.id = c.id_empresa
                          WHERE e.id_usuario = ${userId})`
                    ),
                },
            },
        ],
    };
};

/**
 * Busca reportes por nombre utilizando un query param 'q'. La búsqueda es insensible a mayúsculas y devuelve reportes que contienen el término de búsqueda en su nombre. Los resultados incluyen información de campaña, categoría y empresa, y están ordenados por activos primero y luego por fecha de fin más reciente. Si 'q' no se proporciona o es muy corto, devuelve un array vacío.
 * @param {*} req - Request con query param 'q' para búsqueda de nombre de reporte
 * @param {*} res - Response con resultados de búsqueda de reportes que coinciden con el query, incluyendo información de campaña, categoría y empresa, ordenados por activos primero y luego por fecha de fin más reciente. Si 'q' no se proporciona o es muy corto, devuelve un array vacío.
 * @returns - JSON con resultados de búsqueda de reportes que coinciden con el query, incluyendo información de campaña, categoría y empresa, ordenados por activos primero y luego por fecha de fin más reciente. Si 'q' no se proporciona o es muy corto, devuelve un array vacío.
 */
const reportSearch = async (req, res) => {
    try {
        const { q, year, category_id } = req.query;

        const hasQuery = q && q.length >= 2;
        if (!hasQuery && !year && !category_id) {
            return res.json({ results: [] });
        }

        const andConditions = [];

        if (hasQuery) {
            andConditions.push(buildNameCondition(q, 'reportes.nombre'));
        }

        if (year) {
            andConditions.push(buildYearCondition(year));
        }

        if (category_id) {
            andConditions.push({ '$campana.id_categoria$': category_id });
        }

        // admin/superadmin ven TODOS los reportes (y en cada resultado se indica de quién es); el resto de
        // roles solo los suyos (ver buildReportVisibility).
        const seesAll = isUnrestricted(req.user);
        const visibility = buildReportVisibility(req.user);
        if (visibility) {
            andConditions.push(visibility);
        }

        const reportes = await md.reportes.findAll({
            where: andConditions.length ? { [Op.and]: andConditions } : undefined,
            attributes: ['id', 'nombre', 'fecha_ini', 'fecha_fin', 'activo'],
            limit: hasQuery ? 10 : 20,
            include: [
                {
                    model: md.campanas,
                    as: 'campana',
                    attributes: ['id', 'nombre', 'id_categoria'],
                    include: [
                        {
                            model: md.categorias,
                            as: 'categoria',
                            attributes: ['id', 'nombre'],
                            include: [
                                {
                                    model: md.empresas,
                                    as: 'empresa',
                                    attributes: ['id', 'nombre', 'id_usuario']
                                }
                            ]
                        }
                    ]
                }
            ],
            order: [
                ['activo', 'DESC'],   // activos primero
                ['fecha_fin', 'DESC'] // más recientes primero
            ]
        });

        // Solo para admin/superadmin: a quién pertenece cada reporte = el responsable de SU EMPRESA (un reporte
        // pertenece a un solo usuario: el dueño de la empresa). Una consulta de nombres para todos.
        const ownerOf = (r) => r.campana?.categoria?.empresa?.id_usuario;
        const owners = new Map();
        if (seesAll) {
            const ownerIds = [...new Set(reportes.map(ownerOf).filter(Boolean))];
            if (ownerIds.length > 0) {
                const users = await md.usuarios.findAll({ where: { id: ownerIds }, attributes: ['id', 'nombre'] });
                users.forEach((u) => owners.set(u.id, u.nombre));
            }
        }

        return res.json({
            results: reportes.map(r => ({
                id: r.id,
                nombre: r.nombre,
                activo: r.activo,
                ...(seesAll && { responsable: owners.get(ownerOf(r)) ?? null }),
                periodo: (r.fecha_ini && r.fecha_fin) ? `${formatDate(r.fecha_ini)} - ${formatDate(r.fecha_fin)}` : null,
                empresa: r.campana?.categoria?.empresa?.nombre,
                categoria: r.campana?.categoria?.nombre,
                campana: r.campana?.nombre,
                // URL directa al reporte
                url: `/admin/${r.campana?.categoria?.empresa?.id}/${r.campana?.categoria?.id}/${r.campana?.id}/${r.id}/report/edit`
            }))
        });

    } catch (error) {
        res.status(500).json({ error: 'Error en búsqueda' });
    }
};

/**
 * Devuelve las opciones disponibles (años y categorías) para filtrar la búsqueda
 * de campañas, respetando la misma visibilidad que campaignSearch: un usuario
 * normal solo ve años/categorías de sus reportes (ver buildReportVisibility);
 * admin/superadmin ven todos.
 *
 * Si se envía 'q' (y opcionalmente 'year' para las categorías), las opciones se
 * acotan a las que realmente tienen coincidencias con esa búsqueda, en lugar de
 * mostrar siempre el listado completo.
 */
const reportSearchFilters = async (req, res) => {
    try {
        const { q, year } = req.query;
        const hasQuery = q && q.length >= 2;

        const visibility = buildReportVisibility(req.user);
        const visibilityCondition = visibility ? [visibility] : [];
        const nameCondition = hasQuery ? [buildNameCondition(q, 'reportes.nombre')] : [];

        // Se consulta desde md.reportes (misma base/joins que campaignSearch) en vez de
        // desde categorias, porque anidar el where dentro de un include de 2 niveles con
        // attributes: [] rompe el armado del objeto anidado en Sequelize (categoria queda
        // undefined). Acá se arma el listado deduplicando en JS.
        const reportesForYears = await md.reportes.findAll({
            where: { [Op.and]: [...visibilityCondition, ...nameCondition] },
            attributes: ['fecha_ini', 'fecha_fin'],
            raw: true,
        });

        const yearsSet = new Set();
        reportesForYears.forEach((r) => {
            if (r.fecha_ini) yearsSet.add(new Date(r.fecha_ini).getFullYear());
            if (r.fecha_fin) yearsSet.add(new Date(r.fecha_fin).getFullYear());
        });

        return res.json({ years: Array.from(yearsSet).sort((a, b) => b - a) });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener filtros de búsqueda' });
    }
};

const companySearch = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ results: [] });
        }
        const normalized = q.replace(/\s+/g, '');
        // 'empresas.nombre' (y no solo 'nombre') porque con el responsable incluido la columna sería ambigua.
        const conditions = [
            Sequelize.where(
                Sequelize.fn('REPLACE', Sequelize.col('empresas.nombre'), ' ', ''),
                { [Op.iLike]: `%${normalized}%` }
            ),
        ];
        // admin/superadmin ven TODAS las empresas (y en cada resultado se indica de quién es); el resto de
        // roles solo las suyas (empresas.id_usuario = el usuario de la sesión).
        const seesAll = isUnrestricted(req.user);
        if (!seesAll) {
            conditions.push({ id_usuario: req.user.id });
        }
        const empresas = await md.empresas.findAll({
            where: { [Op.and]: conditions },
            attributes: ['id', 'nombre', 'activo'],
            include: seesAll ? [{ model: md.usuarios, as: 'user', attributes: ['id', 'nombre'] }] : [],
            limit: 10,
            order: [['nombre', 'ASC']]
        });
        return res.json({
            results: empresas.map(e => ({
                id: e.id,
                nombre: e.nombre,
                activo: e.activo,
                ...(seesAll && { responsable: e.user?.nombre ?? null }),
                url: `/admin/companies/${e.id}`
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en búsqueda' });
    }
};

/**
 * Búsqueda de CATEGORÍAS (2.º nivel): el texto se compara con el nombre de la categoría o de su empresa. Lleva a la
 * lista de campañas de la categoría. Visibilidad: admin/superadmin ven todas; el resto, las de sus empresas.
 */
const categorySearch = async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.length < 2) {
            return res.json({ results: [] });
        }
        const conditions = [
            { [Op.or]: [buildNameCondition(q, 'categorias.nombre'), buildNameCondition(q, 'empresa.nombre')] },
        ];
        const seesAll = isUnrestricted(req.user);
        if (!seesAll) {
            conditions.push({ '$empresa.id_usuario$': Number(req.user.id) });
        }
        const categorias = await md.categorias.findAll({
            where: { [Op.and]: conditions },
            attributes: [
                'id',
                'nombre',
                'activo',
                [Sequelize.literal('(SELECT COUNT(*) FROM campanas cc WHERE cc.id_categoria = "categorias"."id")'), 'total_campanas'],
            ],
            include: [{ model: md.empresas, as: 'empresa', attributes: ['id', 'nombre', 'id_usuario'], required: true }],
            limit: 10,
            order: [['activo', 'DESC'], ['id', 'DESC']],
        });
        const owners = new Map();
        if (seesAll) {
            const ownerIds = [...new Set(categorias.map((c) => c.empresa?.id_usuario).filter(Boolean))];
            if (ownerIds.length > 0) {
                const users = await md.usuarios.findAll({ where: { id: ownerIds }, attributes: ['id', 'nombre'] });
                users.forEach((u) => owners.set(u.id, u.nombre));
            }
        }
        return res.json({
            results: categorias.map((c) => ({
                id: c.id,
                nombre: c.nombre,
                activo: c.activo,
                ...(seesAll && { responsable: owners.get(c.empresa?.id_usuario) ?? null }),
                total_campanas: Number(c.get('total_campanas')),
                empresa: c.empresa?.nombre,
                url: `/admin/${c.empresa?.id}/${c.id}/campaigns`,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en búsqueda' });
    }
};

const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}


/**
 * Búsqueda de CAMPAÑAS (3er nivel). El texto se compara con el nombre de la campaña, de su categoría o de su
 * empresa, así "Coca" encuentra todas las campañas de esa empresa. Cada resultado lleva a la lista de reportes de
 * la campaña. La visibilidad es la misma que la de los reportes: admin/superadmin ven todas; el resto, las de sus
 * empresas o aquellas donde tiene algún reporte asignado. El año filtra campañas que tengan algún reporte ese año.
 */

// Condición SQL (texto) de campañas visibles para un usuario no admin; null para admin/superadmin.
const buildCampaignVisibility = (user) => {
    if (isUnrestricted(user)) return null;
    const userId = Number(user.id);
    return {
        [Op.or]: [
            { '$categoria.empresa.id_usuario$': userId },
            Sequelize.literal(`EXISTS (SELECT 1 FROM reportes rv WHERE rv.id_campana = "campanas"."id" AND rv.id_usuario = ${userId})`),
        ],
    };
};

const buildCampaignTextCondition = (q) => ({
    [Op.or]: [
        buildNameCondition(q, 'campanas.nombre'),
        buildNameCondition(q, 'categoria.nombre'),
        buildNameCondition(q, 'categoria->empresa.nombre'),
    ],
});

// El año va como número dentro del SQL (parseInt + rango evitan cualquier texto raro).
const buildCampaignYearCondition = (year) => {
    const y = Number.parseInt(year, 10);
    if (!Number.isInteger(y) || y < 2000 || y > 2100) return null;
    return Sequelize.literal(
        `EXISTS (SELECT 1 FROM reportes ry WHERE ry.id_campana = "campanas"."id" AND (EXTRACT(YEAR FROM ry.fecha_ini) = ${y} OR EXTRACT(YEAR FROM ry.fecha_fin) = ${y}))`
    );
};

const campaignSearch = async (req, res) => {
    try {
        const { q, year, category_id } = req.query;

        const hasQuery = q && q.length >= 2;
        if (!hasQuery && !year && !category_id) {
            return res.json({ results: [] });
        }

        const andConditions = [];
        if (hasQuery) andConditions.push(buildCampaignTextCondition(q));
        if (year) {
            const yearCondition = buildCampaignYearCondition(year);
            if (yearCondition) andConditions.push(yearCondition);
        }
        if (category_id) andConditions.push({ id_categoria: category_id });

        const seesAll = isUnrestricted(req.user);
        const visibility = buildCampaignVisibility(req.user);
        if (visibility) andConditions.push(visibility);

        const campanas = await md.campanas.findAll({
            where: andConditions.length ? { [Op.and]: andConditions } : undefined,
            attributes: [
                'id',
                'nombre',
                'activo',
                [Sequelize.literal('(SELECT COUNT(*) FROM reportes rc WHERE rc.id_campana = "campanas"."id")'), 'total_reportes'],
            ],
            limit: hasQuery ? 10 : 20,
            include: [
                {
                    model: md.categorias,
                    as: 'categoria',
                    attributes: ['id', 'nombre'],
                    required: true,
                    include: [{ model: md.empresas, as: 'empresa', attributes: ['id', 'nombre', 'id_usuario'], required: true }],
                },
            ],
            order: [
                ['activo', 'DESC'],   // activas primero
                ['id', 'DESC'],       // más recientes primero
            ],
        });

        // Solo para admin/superadmin: responsable de la empresa de cada campaña.
        const ownerOf = (c) => c.categoria?.empresa?.id_usuario;
        const owners = new Map();
        if (seesAll) {
            const ownerIds = [...new Set(campanas.map(ownerOf).filter(Boolean))];
            if (ownerIds.length > 0) {
                const users = await md.usuarios.findAll({ where: { id: ownerIds }, attributes: ['id', 'nombre'] });
                users.forEach((u) => owners.set(u.id, u.nombre));
            }
        }

        return res.json({
            results: campanas.map((c) => ({
                id: c.id,
                nombre: c.nombre,
                activo: c.activo,
                ...(seesAll && { responsable: owners.get(ownerOf(c)) ?? null }),
                total_reportes: Number(c.get('total_reportes')),
                empresa: c.categoria?.empresa?.nombre,
                categoria: c.categoria?.nombre,
                // Lista de reportes de la campaña
                url: `/admin/${c.categoria?.empresa?.id}/${c.categoria?.id}/${c.id}/reports`,
            })),
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en búsqueda' });
    }
};

/**
 * Filtros (años y categorías) para la búsqueda de campañas, acotados a lo que coincide con el texto y a lo que
 * el usuario puede ver. Los años salen de los reportes de esas campañas.
 */
const campaignSearchFilters = async (req, res) => {
    try {
        const { q, year } = req.query;
        const hasQuery = q && q.length >= 2;

        const base = [];
        if (hasQuery) base.push(buildCampaignTextCondition(q));
        const visibility = buildCampaignVisibility(req.user);
        if (visibility) base.push(visibility);

        const campanas = await md.campanas.findAll({
            where: base.length ? { [Op.and]: base } : undefined,
            attributes: ['id'],
            include: [
                {
                    model: md.categorias,
                    as: 'categoria',
                    attributes: ['id'],
                    required: true,
                    include: [{ model: md.empresas, as: 'empresa', attributes: ['id', 'id_usuario'], required: true }],
                },
                { model: md.reportes, as: 'reportes', attributes: ['fecha_ini', 'fecha_fin'], required: false },
            ],
        });

        const yearsSet = new Set();
        campanas.forEach((c) => (c.reportes ?? []).forEach((r) => {
            if (r.fecha_ini) yearsSet.add(new Date(r.fecha_ini).getFullYear());
            if (r.fecha_fin) yearsSet.add(new Date(r.fecha_fin).getFullYear());
        }));

        return res.json({ years: Array.from(yearsSet).sort((a, b) => b - a) });
    } catch (error) {
        res.status(500).json({ error: 'Error al obtener filtros de búsqueda' });
    }
};

module.exports = {
    campaignSearch,
    campaignSearchFilters,
    reportSearch,
    reportSearchFilters,
    categorySearch,
    companySearch
};