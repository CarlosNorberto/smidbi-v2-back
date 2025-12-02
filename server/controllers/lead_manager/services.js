const md = require('../../models');

const getAll = async (req, res) => {
  try {
    const services = await md.services.findAll();
    res.status(200).json(services);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

const saveUpdate = async (req, res) => {
    try {
        if (!req.body) {
            return res.status(400).json({ error: 'Datos no proporcionados' });
        }
        const { id, service, bgcolor, color } = req.body;
        if (!service) {
            return res.status(400).json({ error: 'El campo "service" es obligatorio' });
        }
        const [serviceRecord] = await md.services.upsert({
            id,
            service,
            bgcolor,
            color
        }, { returning: true, conflictFields: ['service'] });
        res.status(id ? 200 : 201).json(serviceRecord);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

module.exports = {
    getAll,
    saveUpdate
};