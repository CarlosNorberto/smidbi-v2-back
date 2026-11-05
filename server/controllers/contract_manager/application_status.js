const md = require('../../models');

const getAll = async (req,res) =>{
    try {
        const status = await md.application_status.findAll({
            order:[['application_status_name', 'ASC']]
        })
        res.status(200).json(status);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const save = async (req, res) => {
    try {        
        const { application_status_name, bgcolor } = req.body;
        if (!application_status_name) {
            return res.status(400).json({ message: "El campo 'application_status_name' es obligatorio." });
        }
        const status = await md.application_status.create({
            application_status_name: application_status_name,
            bgcolor: bgcolor
        });
        res.status(201).json(status);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const update = async (req, res) => {
    try {
        const { applicationStatusId } = req.params;
        const { application_status_name, bgcolor } = req.body;
        const status = await md.application_status.findByPk(applicationStatusId);
        if (!status) {
            return res.status(404).json({ message: "No se encuentra el estado de aplicación con el ID especificado." });
        }
        if (!application_status_name || !String(application_status_name).trim()) {
            return res.status(400).json({ message: "El campo 'application_status_name' es obligatorio." });
        }
        // Se espera el guardado: antes se respondía antes de terminar y un fallo no llegaba al usuario.
        await status.update({ application_status_name: application_status_name, bgcolor: bgcolor });
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