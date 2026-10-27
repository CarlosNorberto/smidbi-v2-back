const md = require('../../models');

// Para detectar repetidos se comparan los nombres sin tildes, sin mayúsculas y con los espacios unificados:
// "Bienes raíces", "bienes raices" y " Bienes  Raíces " son el mismo rubro.
const normalize = (text) => String(text ?? '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

const getAll = async (req, res) => {
    try {
        const industries = await md.industries.findAll({
            where: { active: true },
            attributes: ['id', 'name'],
            order: [['name', 'ASC']],
        });
        res.status(200).json(industries);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
};

// Crea un rubro nuevo. Si ya existe (aunque esté escrito distinto) no se duplica: responde 409 con el rubro existente
// para que la pantalla lo seleccione. Un rubro desactivado que coincide se vuelve a activar.
const create = async (req, res) => {
    try {
        const name = String(req.body?.name ?? '').replace(/\s+/g, ' ').trim();
        if (!name) return res.status(400).json({ message: 'Escriba el nombre del rubro.' });
        if (name.length < 2 || name.length > 120) {
            return res.status(400).json({ message: 'El nombre del rubro debe tener entre 2 y 120 caracteres.' });
        }

        const all = await md.industries.findAll({ attributes: ['id', 'name', 'active'] });
        const existing = all.find((industry) => normalize(industry.name) === normalize(name));
        if (existing) {
            if (!existing.active) await existing.update({ active: true });
            return res.status(409).json({
                message: `Ya existe el rubro «${existing.name}».`,
                industry: { id: existing.id, name: existing.name },
            });
        }

        const created = await md.industries.create({ name, active: true });
        res.status(201).json({ id: created.id, name: created.name });
    } catch (error) {
        res.status(500).json({ message: 'Error interno del servidor: ' + error.message });
    }
};

module.exports = { getAll, create };
