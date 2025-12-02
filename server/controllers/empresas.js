const md = require('../models');

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const empresa = await md.empresas.findOne({
            where: {
                id: id,
                activo: true
            },
            attributes: ['id', 'nombre', 'descripcion', 'email'],
        });
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        res.status(200).json(empresa);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la empresa: ${error.message}` });
    }
};

const getAll = async (req, res) => {
    try {        
        const { name = null } = req.query;        
        let where = { activo: true };
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        const empresas = await md.empresas.findAll({
            where: where,
            attributes: ['id', 'nombre', 'descripcion', 'email'],
            order: [['fecha_creacion', 'DESC']],
        });
        res.status(200).json(empresas);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las empresas: ${error.message}` });
    }
};

const getAllByUsers = async (req, res) => {
    try {        
        const { user_ids } = req.params;
        const { page = 1, limit = 10, name = null } = req.query;        
        const offset = (page - 1) * limit;        
        let where = {
            id_usuario: {
                [md.Sequelize.Op.in]: user_ids.split(',')
            },
            activo: true
        }
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        const empresas = await md.empresas.scope('withUser').findAndCountAll({
            where: where,
            attributes: ['id', 'nombre', 'activo', 'descripcion', 'email'],
            limit,
            offset,
            order: [['fecha_creacion', 'DESC']],
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
    getById,
    getAll,
    getAllByUsers,
    create,
    update,
};
