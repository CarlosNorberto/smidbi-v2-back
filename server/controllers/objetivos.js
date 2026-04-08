const md = require('../models');

const getAll = async (req, res) => {
    try {
        const objetivos = await md.objetivos.findAll({            
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

const create = async (req, res) => {
    try {
        const { objetivo } = req.body;        
        if (!objetivo || !objetivo.trim()) {
            return res.status(400).json({ message: 'El campo objetivo es obligatorio' });
        }
        req.body.usuario_creacion = req.user.id;
        const newObjetivo = await md.objetivos.create(req.body);
        res.status(201).json(newObjetivo);
    } catch (error) {       
        res.status(500).json({ message: `Error al crear el objetivo: ${error.message}` });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { objetivo, activo } = req.body;
        const existing = await md.objetivos.findByPk(id);
        if (!existing) {
            return res.status(404).json({ message: 'Objetivo no encontrado' });
        }
        if (objetivo !== undefined && !objetivo.trim()) {
            return res.status(400).json({ message: 'El campo objetivo no puede estar vacío' });
        }
        req.body.usuario_modificacion = req.user.id;
        const updatedObjetivo = await existing.update(req.body);
        res.status(200).json(updatedObjetivo);
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar el objetivo: ${error.message}` });
    }
};

module.exports = {
    getAll,
    create,
    update
};