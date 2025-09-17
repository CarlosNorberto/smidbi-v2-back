const md = require('../models');

const getAllByCompany = async (req, res) => {
    try {        
        const { company_id } = req.params;
        console.log('req.query', req.query)
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
        });

        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getAllByCompany,
};
