const { Op, fn, col, where } = require('sequelize');
const md = require('../../models');

const HEX_COLOR = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const MAX_NAME = 100;

// Nombre y color del body, ya limpios. Si algo no es válido devuelve { error } con el mensaje para el usuario.
const parseBody = (body) => {
    const name = String(body.application_status_name ?? '').trim();
    if (!name) return { error: "El campo 'application_status_name' es obligatorio." };
    if (name.length > MAX_NAME) return { error: `El nombre no puede superar los ${MAX_NAME} caracteres.` };
    const bgcolor = body.bgcolor ? String(body.bgcolor).trim() : undefined;
    if (bgcolor && !HEX_COLOR.test(bgcolor)) return { error: 'El color debe ser un valor hexadecimal, por ejemplo #1677ff.' };
    return { name, bgcolor };
};

// ¿Ya existe otro estado con ese nombre (sin distinguir mayúsculas)? `exceptId` excluye al que se está editando.
const nameTaken = async (name, exceptId = null) => {
    const filters = [where(fn('lower', col('application_status_name')), name.toLowerCase())];
    if (exceptId) filters.push({ id: { [Op.ne]: exceptId } });
    return (await md.application_status.count({ where: { [Op.and]: filters } })) > 0;
};

const getAll = async (req,res) =>{
    try {
        // `contracts_count`: cuántos contratos usan cada estado (la pantalla de configuración lo muestra al borrar).
        const status = await md.application_status.findAll({
            attributes: {
                include: [[
                    md.sequelize.literal('(SELECT COUNT(*)::int FROM contract_manager.contracts c WHERE c.application_status_id = "application_status"."id")'),
                    'contracts_count',
                ]],
            },
            order:[['application_status_name', 'ASC']]
        })
        res.status(200).json(status);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const save = async (req, res) => {
    try {
        const { name, bgcolor, error } = parseBody(req.body);
        if (error) return res.status(400).json({ message: error });
        if (await nameTaken(name)) {
            return res.status(409).json({ message: `Ya existe un estado de solicitud llamado "${name}".` });
        }
        const status = await md.application_status.create({
            application_status_name: name,
            ...(bgcolor ? { bgcolor } : {}),
        });
        res.status(201).json(status);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const update = async (req, res) => {
    try {
        const { applicationStatusId } = req.params;
        const status = await md.application_status.findByPk(applicationStatusId);
        if (!status) {
            return res.status(404).json({ message: "No se encuentra el estado de aplicación con el ID especificado." });
        }
        const { name, bgcolor, error } = parseBody(req.body);
        if (error) return res.status(400).json({ message: error });
        if (await nameTaken(name, status.id)) {
            return res.status(409).json({ message: `Ya existe un estado de solicitud llamado "${name}".` });
        }
        // Se espera el guardado: antes se respondía antes de terminar y un fallo no llegaba al usuario.
        await status.update({ application_status_name: name, ...(bgcolor ? { bgcolor } : {}) });
        res.status(200).json(status);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const remove = async (req, res) => {
    try {
        const { applicationStatusId } = req.params;
        const status = await md.application_status.findByPk(applicationStatusId);
        if (!status) {
            return res.status(404).json({ message: "No se encuentra el estado de aplicación con el ID especificado." });
        }
        // Los contratos que tenían este estado quedan "Sin Estado", y el estado se elimina: en una transacción,
        // para que no quede a medias.
        await md.sequelize.transaction(async (transaction) => {
            await md.contracts.update({ application_status_id: null }, { where: { application_status_id: applicationStatusId }, transaction });
            await status.destroy({ transaction });
        });
        res.status(200).json({ message: "Estado de aplicación eliminado con exito" });
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getAll,
    save,
    update,
    remove
}
