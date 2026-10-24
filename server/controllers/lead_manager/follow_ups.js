const moment = require('moment-timezone');
const md = require('../../models');

// Historial de gestiones de una oportunidad (tabla follow_up_history, compartida con el sistema viejo).
// Las gestiones nuevas llevan en `type` uno de TIPOS_GESTION. El sistema viejo guardaba aquí también
// sus "observaciones" (type 'observation' / 'situation'): se devuelven en el historial, pero no se
// pueden borrar desde acá para no perder información.
const TIPOS_GESTION = ['correo', 'whatsapp', 'llamada', 'reunion'];

// Fecha elegida (YYYY-MM-DD) al mediodía de Bolivia, para que la gestión caiga en ese día sin importar la zona horaria.
const dateToTimestamp = (date) => new Date(`${date}T12:00:00-04:00`);

// Día (YYYY-MM-DD, hora de Bolivia) de una gestión guardada.
const dayOf = (timestamp) => moment(timestamp).tz('America/La_Paz').format('YYYY-MM-DD');

const userName = (req) => req.user?.nombre || req.user?.email || 'Usuario';

const getByDeal = async (req, res) => {
    try {
        const rows = await md.follow_up_history.findAll({
            where: { prospect_history_id: req.params.id },
            order: [['create_date', 'DESC'], ['id', 'DESC']],
        });
        res.json(rows);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
};

const create = async (req, res) => {
    try {
        const { prospect_history_id, type, date } = req.body;
        const description = String(req.body.description ?? '').trim();
        if (!prospect_history_id) return res.status(400).json({ error: 'prospect_history_id es requerido' });
        if (!TIPOS_GESTION.includes(type)) return res.status(400).json({ error: 'El tipo de contacto no es válido' });
        if (!description) return res.status(400).json({ error: 'La descripción es obligatoria' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return res.status(400).json({ error: 'La fecha no es válida' });

        const deal = await md.prospect_history.findByPk(prospect_history_id);
        if (!deal) return res.status(404).json({ error: 'Oportunidad no encontrada' });

        const row = await md.follow_up_history.create({
            prospect_history_id,
            type,
            description,
            create_date: dateToTimestamp(date),
            created_by: userName(req),
        });

        // Una gestión más reciente actualiza la "fecha de último contacto" de la oportunidad.
        if (!deal.last_contact || String(deal.last_contact).slice(0, 10) < date) {
            await deal.update({ last_contact: date });
        }
        res.status(201).json(row);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
};

// Edita fecha, tipo y descripción de una gestión nueva y deja constancia de quién y cuándo la editó.
const update = async (req, res) => {
    try {
        const row = await md.follow_up_history.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'Gestión no encontrada' });
        if (!TIPOS_GESTION.includes(row.type)) {
            return res.status(403).json({ error: 'Los registros anteriores del sistema no se pueden editar' });
        }
        const { type, date } = req.body;
        const description = String(req.body.description ?? '').trim();
        if (!TIPOS_GESTION.includes(type)) return res.status(400).json({ error: 'El tipo de contacto no es válido' });
        if (!description) return res.status(400).json({ error: 'La descripción es obligatoria' });
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date ?? '')) return res.status(400).json({ error: 'La fecha no es válida' });

        const oldDay = dayOf(row.create_date);
        // La hora se conserva si el día no cambió.
        const create_date = date === oldDay ? row.create_date : dateToTimestamp(date);
        await row.update({ type, description, create_date, updated_by: userName(req), updated_at: new Date() });

        // La fecha de último contacto sube si la gestión editada es más nueva y, si esta era la última y se
        // movió a una fecha anterior, baja a la última gestión que quede.
        const deal = await md.prospect_history.findByPk(row.prospect_history_id);
        if (deal) {
            const current = deal.last_contact ? String(deal.last_contact).slice(0, 10) : null;
            if (!current || current < date) {
                await deal.update({ last_contact: date });
            } else if (current === oldDay && date < oldDay) {
                const latest = await md.follow_up_history.findOne({
                    where: { prospect_history_id: deal.id, type: TIPOS_GESTION },
                    order: [['create_date', 'DESC']],
                });
                await deal.update({ last_contact: latest ? dayOf(latest.create_date) : date });
            }
        }
        res.json(row);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
};

const remove = async (req, res) => {
    try {
        const row = await md.follow_up_history.findByPk(req.params.id);
        if (!row) return res.status(404).json({ error: 'Gestión no encontrada' });
        if (!TIPOS_GESTION.includes(row.type)) {
            return res.status(403).json({ error: 'Los registros anteriores del sistema no se pueden eliminar' });
        }
        await row.destroy();
        res.json({ message: 'Gestión eliminada correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
};

// Atributo calculado para el tablero y la tabla: cuántas gestiones tiene cada oportunidad (0 = ninguna).
const FOLLOW_UPS_COUNT_ATTRIBUTE = [
    md.sequelize.literal('(SELECT COUNT(*)::int FROM lead_manager.follow_up_history f WHERE f.prospect_history_id = "prospect_history"."id")'),
    'follow_ups_count',
];

module.exports = { getByDeal, create, update, remove, TIPOS_GESTION, FOLLOW_UPS_COUNT_ATTRIBUTE };
