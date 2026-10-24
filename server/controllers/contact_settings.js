const md = require('../models');
const { normalizarTelefono } = require('./whatsapp_destinatarios');

// Número de WhatsApp de atención que se muestra en el home público (icono "WhatsApp"). Se guarda en
// system_settings (module 'contacto', key 'whatsapp_publico', value { telefono }) y se edita en
// Administración > Configuraciones > Notificaciones WhatsApp. No es el número de la API de Meta.
const MODULE = 'contacto';
const KEY = 'whatsapp_publico';
const DESCRIPTION = 'Número de WhatsApp de contacto para SMID BI: se muestra como icono en la página de inicio';

const readTelefono = async () => {
    const setting = await md.system_settings.findOne({ where: { module: MODULE, key: KEY } });
    return setting?.active ? setting.value?.telefono ?? null : null;
};

// Público (sin login): solo expone el número, nada más.
const getPublic = async (req, res) => {
    try {
        res.json({ whatsapp: await readTelefono() });
    } catch (error) {
        res.status(500).json({ message: 'No se pudo obtener el contacto' });
    }
};

const get = async (req, res) => {
    try {
        res.json({ telefono: await readTelefono() });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor: ' + error.message });
    }
};

// Un teléfono vacío desactiva el icono de WhatsApp del home.
const save = async (req, res) => {
    try {
        const raw = String(req.body.telefono ?? '').trim();
        const telefono = raw ? normalizarTelefono(raw) : null;
        if (telefono && !/^\d{8,15}$/.test(telefono)) {
            return res.status(400).json({ message: 'El teléfono no es válido: use el número con código de país (ej. 59177495009)' });
        }
        const [setting] = await md.system_settings.findOrCreate({
            where: { module: MODULE, key: KEY },
            defaults: {
                value: { telefono },
                description: DESCRIPTION,
                active: true,
            },
        });
        await setting.update({ value: { telefono }, description: DESCRIPTION, active: true, updated_at: new Date() });
        res.json({ telefono });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor: ' + error.message });
    }
};

module.exports = { getPublic, get, save };
