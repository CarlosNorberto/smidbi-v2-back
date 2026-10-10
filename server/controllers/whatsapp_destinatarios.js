const md = require('../models');
const { PROCESOS, PROCESOS_KEYS } = require('../config/whatsapp_procesos');

// Deja el número en el formato de la API de Meta: solo dígitos, con código de país y sin '+'.
// Acepta "+591 6714-6124", "591 67146124", "0059167146124" o un celular boliviano de 8 dígitos
// ("67146124"), al que se le antepone 591.
const normalizarTelefono = (raw) => {
    let digits = String(raw ?? '').replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (/^[67]\d{7}$/.test(digits)) digits = `591${digits}`;
    return digits;
};

// Valida y arma los campos editables. Devuelve { error } o { data }.
const parseBody = (body) => {
    const nombre = String(body.nombre ?? '').trim();
    if (!nombre) return { error: 'El nombre es obligatorio' };

    const telefono = normalizarTelefono(body.telefono);
    if (!/^\d{8,15}$/.test(telefono)) {
        return { error: 'El teléfono no es válido: use el número con código de país (ej. 59167146124)' };
    }

    const procesos = Array.isArray(body.procesos) ? [...new Set(body.procesos)] : [];
    const invalido = procesos.find((p) => !PROCESOS_KEYS.includes(p));
    if (invalido) return { error: `Proceso desconocido: ${invalido}` };

    return { data: { nombre, telefono, procesos, activo: body.activo ?? true } };
};

const getProcesos = (req, res) => res.status(200).json(PROCESOS);

const getAll = async (req, res) => {
    try {
        const destinatarios = await md.whatsapp_destinatarios.findAll({ order: [['nombre', 'ASC']] });
        res.status(200).json(destinatarios);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los destinatarios: ${error.message}` });
    }
};

const create = async (req, res) => {
    try {
        const { error, data } = parseBody(req.body);
        if (error) return res.status(400).json({ message: error });
        const destinatario = await md.whatsapp_destinatarios.create(data);
        res.status(201).json(destinatario);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Ese número ya está registrado' });
        }
        res.status(500).json({ message: `Error al crear el destinatario: ${error.message}` });
    }
};

const update = async (req, res) => {
    try {
        const destinatario = await md.whatsapp_destinatarios.findByPk(req.params.id);
        if (!destinatario) return res.status(404).json({ message: 'Destinatario no encontrado' });

        // Cambio parcial (p. ej. solo activar/desactivar desde el interruptor de la tabla).
        const { error, data } = parseBody({ ...destinatario.toJSON(), ...req.body });
        if (error) return res.status(400).json({ message: error });

        await destinatario.update(data);
        res.status(200).json(destinatario);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(409).json({ message: 'Ese número ya está registrado' });
        }
        res.status(500).json({ message: `Error al actualizar el destinatario: ${error.message}` });
    }
};

const remove = async (req, res) => {
    try {
        const deleted = await md.whatsapp_destinatarios.destroy({ where: { id: req.params.id } });
        if (!deleted) return res.status(404).json({ message: 'Destinatario no encontrado' });
        res.status(200).json({ message: 'Destinatario eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: `Error al eliminar el destinatario: ${error.message}` });
    }
};

module.exports = { getProcesos, getAll, create, update, remove };
