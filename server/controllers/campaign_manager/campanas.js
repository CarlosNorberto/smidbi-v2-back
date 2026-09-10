const md = require('../models');

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const campana = await md.campanas.findOne({
            where: {
                id: id,
                activo: true
            },
            attributes: ['id', 'nombre', 'descripcion', 'mes', 'gestion', 'moneda'],
        });
        if (!campana) {
            return res.status(404).json({ message: 'Campaña no encontrada' });
        }
        res.status(200).json(campana);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la campaña: ${error.message}` });
    }
};

const getByCategory = async (req, res) => {
    try {        
        const { category_id } = req.params;
        const { page = 1, limit = 10, details = false, name = null } = req.query;        
        const offset = (page - 1) * limit;
        let where = {            
            activo: true,
            id_categoria: category_id
        };
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        let attributes = ['id', 'nombre', 'descripcion', 'mes', 'gestion', 'moneda'];
        if (details === 'true') {
            attributes = { exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion'] };
        }
        const campanas = await md.campanas.findAndCountAll({
            where,
            limit,
            offset,
            attributes,
            order: [['fecha_creacion', 'DESC']],
        });
        res.status(200).json(campanas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = {
    getById,
    getByCategory
};
