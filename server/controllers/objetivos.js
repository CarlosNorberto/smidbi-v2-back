const md = require('../models');

const getAll = async (req, res) => {
    try {
        const objetivos = await md.objetivos.findAll({
            where: {
                activo: true
            },
            order: [['objetivo', 'ASC']],
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_creacion', 'fecha_modificacion', 'fecha_eliminacion'],
            }
        });
        res.status(200).json(objetivos);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los objetivos: ${error.message}` });
    }
};

module.exports = {
    getAll
};