const md = require('../models');

const getAllByUser = async (req, res) => {
    try {        
        const { page = 1, limit = 10 } = req.params;        
        const offset = (page - 1) * limit;
        let where = {
            id_usuario: req.user.id,
            activo: true
        }
        if (req.body){
            const { name } = req.body;
            if (name) {
                where.nombre = {
                    [md.Sequelize.Op.iLike]: `%${name}%`
                };
            }
        }        
        const empresas = await md.empresas.findAndCountAll({
            where: where,
            attributes: ['id', 'nombre', 'activo', 'descripcion', 'email'],
            order: [['fecha_creacion', 'DESC']],
            limit,
            offset,
        });
        res.status(200).json(empresas);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las empresas: ${error.message}` });
    }
};

const create = async (req, res) => {
    try {
        req.body.usuario_creacion = req.user.id;
        const newEmpresa = await md.empresas.create(req.body);
        res.status(201).json(newEmpresa);
    } catch (error) {
        res.status(500).json({ message: `Error al crear la empresa: ${error.message}` });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const empresa = await md.empresas.findOne({
            where: {
                id: id,
            },
        });
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        const updatedEmpresa = await empresa.update(req.body);
        res.status(200).json(updatedEmpresa);
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar la empresa: ${error.message}` });
    }
};

module.exports = {
    getAllByUser,
    create,
    update,
};
