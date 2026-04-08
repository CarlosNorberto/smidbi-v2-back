
const md = require('../models');
const { Op } = require('sequelize');
const Sequelize = require('sequelize');

/**
 * Busca reportes por nombre utilizando un query param 'q'. La búsqueda es insensible a mayúsculas y devuelve reportes que contienen el término de búsqueda en su nombre. Los resultados incluyen información de campaña, categoría y empresa, y están ordenados por activos primero y luego por fecha de fin más reciente. Si 'q' no se proporciona o es muy corto, devuelve un array vacío.
 * @param {*} req - Request con query param 'q' para búsqueda de nombre de reporte
 * @param {*} res - Response con resultados de búsqueda de reportes que coinciden con el query, incluyendo información de campaña, categoría y empresa, ordenados por activos primero y luego por fecha de fin más reciente. Si 'q' no se proporciona o es muy corto, devuelve un array vacío.
 * @returns - JSON con resultados de búsqueda de reportes que coinciden con el query, incluyendo información de campaña, categoría y empresa, ordenados por activos primero y luego por fecha de fin más reciente. Si 'q' no se proporciona o es muy corto, devuelve un array vacío.
 */
const campaignSearch = async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 2) {
            return res.json({ results: [] });
        }
        const normalized = q.replace(/\s+/g, '');
        let where = Sequelize.where(
            Sequelize.fn('REPLACE', Sequelize.col('reportes.nombre'), ' ', ''),
            { [Op.iLike]: `%${normalized}%` }
        );
        where = {
            [Op.and]: [
                where,
                {
                    id_usuario: req.user.id
                }
            ]
        };    
        if (req.user.role.rol === 'admin') {
            delete where[Op.and][1]; // eliminar filtro por usuario para admin
        }
        // check user role admin: show all, else filter by user_id        
        const reportes = await md.reportes.findAll({
            where: where,
            attributes: ['id', 'nombre', 'fecha_ini', 'fecha_fin', 'activo'],
            limit: 10,
            include: [
                {
                    model: md.campanas,
                    as: 'campana',
                    attributes: ['id', 'nombre'],
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
        if (req.user.role.rol === 'admin') {
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
    companySearch
};