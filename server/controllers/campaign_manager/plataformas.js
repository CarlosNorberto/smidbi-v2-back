const md = require('../../models');

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

// Listado completo (activas e inactivas) para la pantalla de administración —
// distinto de getAll, que solo devuelve activas para selects/formularios normales.
const getAllAdmin = async (req, res) => {
    try {
        const plataformas = await md.plataformas.findAll({
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

const create = async (req, res) => {
    try {
        const { plataforma } = req.body;
        if (!plataforma || !plataforma.trim()) {
            return res.status(400).json({ message: 'El campo plataforma es obligatorio' });
        }
        req.body.usuario_creacion = req.user.id;
        const newPlataforma = await md.plataformas.create(req.body);
        res.status(201).json(newPlataforma);
    } catch (error) {
        res.status(500).json({ message: `Error al crear la plataforma: ${error.message}` });
    }
};

// No hay `remove`/delete a propósito: las plataformas no se borran, solo se
// desactivan (costo_por tiene FK con ON DELETE RESTRICT hacia esta tabla).
const update = async (req, res) => {
    try {
        const { id } = req.params;
        const { plataforma } = req.body;
        const existing = await md.plataformas.findByPk(id);
        if (!existing) {
            return res.status(404).json({ message: 'Plataforma no encontrada' });
        }
        // Las plataformas "bloqueadas" (placeholders históricos creados para
        // preservar datos huérfanos) no se pueden editar ni activar — no
        // representan una plataforma real, solo un marcador de datos viejos.
        if (existing.bloqueada) {
            return res.status(403).json({ message: 'Esta plataforma es un marcador histórico y no se puede editar ni activar.' });
        }
        if (plataforma !== undefined && !plataforma.trim()) {
            return res.status(400).json({ message: 'El campo plataforma no puede estar vacío' });
        }
        req.body.usuario_modificacion = req.user.id;
        delete req.body.bloqueada;
        const updated = await existing.update(req.body);
        res.status(200).json(updated);
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar la plataforma: ${error.message}` });
    }
};

module.exports = {
    getAll,
    getAllAdmin,
    create,
    update,
};