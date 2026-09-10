const md = require('../models');

const getAll = async (req, res) => {
    try {
        const plataformas = await md.plataformas.findAll({
            where: {
                activo: true
            },
            order: [['plataforma', 'ASC']],
            attributes: {
                exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion', 'fecha_creacion', 'fecha_modificacion', 'fecha_eliminacion'],
            }
        });
        res.status(200).json(plataformas);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las plataformas: ${error.message}` });
    }
};

module.exports = {
    getAll
};