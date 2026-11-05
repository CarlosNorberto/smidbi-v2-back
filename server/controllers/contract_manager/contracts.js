const md = require('../../models');
const { generateContractCode } = require('../../helps');
const { deleteContract } = require('../../services/contractService');

// Código del contrato (ADM-CTR-<año>-<id>). Los contratos antiguos sin fecha de solicitud usan la de creación para el
// año; antes salían como "ADM-CTR-null-204".
const contractCode = (contract) => generateContractCode(contract.application_date || contract.create_date, contract.id);

const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const contracts = await md.contracts.scope([
            'withCompanyForm',
            'withApplicants',
            'withClientSupport',
            'withResponsibles',
            'withApplicationStatus',
            'withSignedContracts'
        ]).findAndCountAll({
            distinct: true,
            col: 'contracts.id',
            limit: parseInt(limit),
            offset: parseInt(offset),
            order: [['create_date', 'DESC']]
        });
        contracts.rows = contracts.rows.map(contract => {
            const code = contractCode(contract);
            return {
                ...contract.toJSON(),
                code,
            };
        });
        res.status(200).json(contracts);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los contratos: ${error.message}` });
    }
}

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const contract = await md.contracts.scope([
            'withCompanyFormComplete',
            'withApplicants',
            'withClientSupport',
            'withResponsibles',
            'withApplicationStatus',
            'withSignedContracts'
        ]).findByPk(id);
        if (!contract) {
            return res.status(404).json({ message: "No se encuentra el contrato con el ID especificado." });
        }
        const code = contractCode(contract);
        res.status(200).json({
            ...contract.toJSON(),
            code,
        });
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el contrato: ${error.message}` });
    }
}

// Id de la URL -> número, o null si es '0' / 'null' (desasignar). Devuelve undefined si no es un id válido.
const parseNullableId = (value) => {
    if (value === '0' || value === 'null' || value === null) return null;
    return /^\d+$/.test(String(value)) ? Number(value) : undefined;
};

// Cambia UN campo de asignación del contrato (estado, solicitante, soporte, responsable). Espera el guardado antes
// de responder (antes se respondía 200 sin esperarlo, así que un fallo no llegaba nunca al usuario).
const updateContractField = (field, paramName) => async (req, res) => {
    try {
        const contract = await md.contracts.findByPk(req.params.contractId);
        if (!contract) {
            return res.status(404).json({ message: "No se encuentra el contrato con el ID especificado." });
        }
        const value = parseNullableId(req.params[paramName]);
        if (value === undefined) {
            return res.status(400).json({ message: 'El valor enviado no es válido.' });
        }
        await contract.update({ [field]: value, write_date: new Date() });
        res.status(200).json(contract);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

const changeApplicationStatus = updateContractField('application_status_id', 'applicationStatusId');
const changeApplicant = updateContractField('applicant_id', 'applicantId');
const changeClientSupport = updateContractField('client_support_id', 'clientSupportId');
const changeResponsible = updateContractField('responsible_id', 'responsibleId');

const changeObservations = async (req, res) => {
    try {
        const { contractId } = req.params;
        let { observations } = req.body;
        const contract = await md.contracts.findByPk(contractId);
        if (!contract) {
            return res.status(404).json({ message: "No se encuentra el contrato con el ID especificado." });
        }
        observations = observations && observations !== 'null' ? observations : null;
        await contract.update({ observations, write_date: new Date() });
        res.status(200).json(contract);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
}

// Elimina el contrato completo (contratos firmados, archivos y formulario de la empresa). Solo admin y superadmin
// (ver la ruta). Es irreversible.
const remove = async (req, res) => {
    try {
        const result = await deleteContract(req.params.id);
        if (!result) {
            return res.status(404).json({ message: 'No se encuentra el contrato con el ID especificado.' });
        }
        const warning = result.filesFailed > 0
            ? ` No se pudieron borrar ${result.filesFailed} archivo(s) firmados del almacenamiento; quedó registrado en el registro de errores.`
            : '';
        res.status(200).json({ message: `Contrato eliminado correctamente.${warning}`, ...result });
    } catch (error) {
        res.status(500).json({ message: `Error al eliminar el contrato: ${error.message}` });
    }
}

module.exports = {
    getAll,
    getById,
    changeApplicationStatus,
    changeApplicant,
    changeClientSupport,
    changeResponsible,
    changeObservations,
    remove,
}
