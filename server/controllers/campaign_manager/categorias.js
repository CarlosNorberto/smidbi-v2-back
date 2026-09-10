const md = require('../models');

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const categoria = await md.categorias.findOne({
            where: {
                id: id,
                activo: true
            },
            attributes: ['id', 'nombre', 'descripcion'],
        });
        if (!categoria) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }
        res.status(200).json(categoria);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la categoría: ${error.message}` });
    }
};

const getAllByCompany = async (req, res) => {
    try {        
        const { company_id } = req.params;        
        const { page = 1, limit = 10, name = null } = req.query;
        const offset = (page - 1) * limit;
        let where = {
            id_empresa: company_id,
            activo: true
        }
        if (name){            
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        const categories = await md.categorias.findAndCountAll({
            where: where,
            attributes: ['id', 'nombre', 'descripcion'],
            limit,
            offset,
            order: [['fecha_creacion', 'DESC']],
        });

        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getById,
    getAllByCompany,
};
