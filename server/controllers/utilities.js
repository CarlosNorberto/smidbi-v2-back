
const md = require('../models');
const { Op } = require('sequelize');
const Sequelize = require('sequelize');

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
 * Busca reportes por nombre utilizando un query param 'q'. La búsqueda es insensible a mayúsculas y devuelve reportes que contienen el término de búsqueda en su nombre. Los resultados incluyen información de campaña, categoría y empresa, y están ordenados por activos primero y luego por fecha de fin más reciente. Si 'q' no se proporciona o es muy corto, devuelve un array vacío.
 * @param {*} req - Request con query param 'q' para búsqueda de nombre de reporte
 * @param {*} res - Response con resultados de búsqueda de reportes que coinciden con el query, incluyendo información de campaña, categoría y empresa, ordenados por activos primero y luego por fecha de fin más reciente. Si 'q' no se proporciona o es muy corto, devuelve un array vacío.
 * @returns - JSON con resultados de búsqueda de reportes que coinciden con el query, incluyendo información de campaña, categoría y empresa, ordenados por activos primero y luego por fecha de fin más reciente. Si 'q' no se proporciona o es muy corto, devuelve un array vacío.
 */
const campaignSearch = async (req, res) => {
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

        // check user role admin/superadmin: show all, else filter by user_id
        if (!['admin', 'superadmin'].includes(req.user.role?.rol)) {
            andConditions.push({ id_usuario: req.user.id });
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
                                    attributes: ['id', 'nombre']
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

        return res.json({
            results: reportes.map(r => ({
                id: r.id,
                nombre: r.nombre,
                activo: r.activo,
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
 * normal solo ve años/categorías de sus propios reportes; admin/superadmin ven todos.
 *
 * Si se envía 'q' (y opcionalmente 'year' para las categorías), las opciones se
 * acotan a las que realmente tienen coincidencias con esa búsqueda, en lugar de
 * mostrar siempre el listado completo.
 */
const campaignSearchFilters = async (req, res) => {
    try {
        const { q, year } = req.query;
        const hasQuery = q && q.length >= 2;

        const isAdmin = ['admin', 'superadmin'].includes(req.user.role?.rol);
        const visibilityCondition = isAdmin ? [] : [{ id_usuario: req.user.id }];
        const nameCondition = hasQuery ? [buildNameCondition(q, 'reportes.nombre')] : [];

        // Se consulta desde md.reportes (misma base/joins que campaignSearch) en vez de
        // desde categorias, porque anidar el where dentro de un include de 2 niveles con
        // attributes: [] rompe el armado del objeto anidado en Sequelize (categoria queda
        // undefined). Acá se arma el listado deduplicando en JS.
        const [reportesForYears, reportesForCategories] = await Promise.all([
            md.reportes.findAll({
                where: { [Op.and]: [...visibilityCondition, ...nameCondition] },
                attributes: ['fecha_ini', 'fecha_fin'],
                raw: true,
            }),
            md.reportes.findAll({
                where: {
                    [Op.and]: [
                        ...visibilityCondition,
                        ...nameCondition,
                        ...(year ? [buildYearCondition(year)] : []),
                    ]
                },
                attributes: ['id'],
                include: [
                    {
                        model: md.campanas,
                        as: 'campana',
                        attributes: ['id'],
                        required: true,
                        include: [
                            {
                                model: md.categorias,
                                as: 'categoria',
                                attributes: ['id', 'nombre'],
                                required: true,
                                include: [
                                    { model: md.empresas, as: 'empresa', attributes: ['id', 'nombre'] }
                                ]
                            }
                        ]
                    }
                ],
            }),
        ]);

        const yearsSet = new Set();
        reportesForYears.forEach((r) => {
            if (r.fecha_ini) yearsSet.add(new Date(r.fecha_ini).getFullYear());
            if (r.fecha_fin) yearsSet.add(new Date(r.fecha_fin).getFullYear());
        });

        const categoriesMap = new Map();
        reportesForCategories.forEach((r) => {
            const categoria = r.campana?.categoria;
            if (categoria && !categoriesMap.has(categoria.id)) {
                categoriesMap.set(categoria.id, {
                    id: categoria.id,
                    nombre: categoria.nombre,
                    empresa: categoria.empresa?.nombre,
                });
            }
        });

        return res.json({
            years: Array.from(yearsSet).sort((a, b) => b - a),
            categories: Array.from(categoriesMap.values()).sort((a, b) => a.nombre.localeCompare(b.nombre)),
        });
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
        let where = Sequelize.where(
            Sequelize.fn('REPLACE', Sequelize.col('nombre'), ' ', ''),
            { [Op.iLike]: `%${normalized}%` }
        );
        where = {
            [Op.and]: [
                where,
                { id_usuario: req.user.id }
            ]
        };
        if (['admin', 'superadmin'].includes(req.user.role?.rol)) {
            delete where[Op.and][1]; // eliminar filtro por usuario para admin
        }
        const empresas = await md.empresas.findAll({
            where: where,
            attributes: ['id', 'nombre', 'activo'],
            limit: 10,
            order: [['nombre', 'ASC']]
        });
        return res.json({
            results: empresas.map(e => ({
                id: e.id,
                nombre: e.nombre,
                activo: e.activo,
                url: `/admin/companies/${e.id}`
            }))
        });
    } catch (error) {
        res.status(500).json({ error: 'Error en búsqueda' });
    }
};

const formatDate = (date) => {
    const d = new Date(date);
    return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}


module.exports = {
    campaignSearch,
    campaignSearchFilters,
    companySearch
};