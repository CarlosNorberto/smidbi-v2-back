const md = require('../models');

const getAll = async (req, res) => {
    try {
        const usuarios = await md.usuarios.findAll({
            where: {
                activo: true
            },
            attributes: ['id', 'nombre', 'email', 'activo'],
            order: [['fecha_creacion', 'DESC']],        
        });
        res.status(200).json(usuarios);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los usuarios: ${error.message}` });
    }
}

module.exports = {
    getAll,  
};