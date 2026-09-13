const md = require('../models');

const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const requestBriefs = await md.request_brief.findAndCountAll({
            attributes: ['id', 'nombre_empresa', 'nombre_campana', 'responsable', 'mail', 'reviewed', 'fecha_creacion', 'copia_from'],
            include: [
                {
                    model: md.qualify_brief,
                    as: 'qualify_brief',
                    attributes: ['qualify'],
                    required: false,
                },
            ],
            order: [
                ['fecha_creacion', 'DESC'],
                ['copia_from', 'ASC'],
            ],
            limit,
            offset,
        });
        res.status(200).json(requestBriefs);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las solicitudes de brief: ${error.message}` });
    }
};

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const requestBrief = await md.request_brief.findByPk(id, {
            include: [
                {
                    model: md.qualify_brief,
                    as: 'qualify_brief',
                    attributes: ['qualify'],
                    required: false,
                },
            ],
        });
        if (!requestBrief) {
            return res.status(404).json({ message: 'No se encontró la solicitud de brief' });
        }
        res.status(200).json(requestBrief);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la solicitud de brief: ${error.message}` });
    }
};

// Copia todos los campos de la solicitud original hacia una nueva fila (igual
// que la app antigua): útil para no cargar todo el brief de cero cuando es
// prácticamente el mismo. La copia arranca sin revisar (reviewed=false) y sin
// calificación/imágenes propias (qualify_brief/qualify_image no se duplican,
// son filas nuevas sin relación).
const duplicate = async (req, res) => {
    try {
        const { id } = req.params;
        const original = await md.request_brief.findByPk(id);
        if (!original) {
            return res.status(404).json({ message: 'No se encontró la solicitud de brief a copiar' });
        }

        const data = original.toJSON();
        delete data.id;
        delete data.fecha_creacion;
        data.fecha_modificacion = null;
        data.usuario_modificacion = null;
        data.reviewed = false;
        data.copia_from = original.id;

        const copy = await md.request_brief.create(data);
        res.status(200).json({ message: 'Solicitud de brief copiada correctamente', data: copy });
    } catch (error) {
        res.status(500).json({ message: `Error al copiar la solicitud de brief: ${error.message}` });
    }
};

module.exports = {
    getAll,
    getById,
    duplicate,
};
