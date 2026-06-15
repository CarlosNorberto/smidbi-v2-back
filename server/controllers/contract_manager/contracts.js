const { getYear, parseISO } = require('date-fns');
const md = require('../../models');
const { generateContractCode } = require('../../helps');

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
            const code = generateContractCode(contract.application_date, contract.id);            
            return {
                ...contract.toJSON(),
                code,
            };
        });
        console.log(contracts.count, contracts.rows.length);
        res.status(200).json(contracts);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los contratos: ${error.message}` });
    }
}

const changeApplicationStatus = async (req, res) => {
    try {
        let { contractId, applicationStatusId } = req.params;
        const contract = await md.contracts.findByPk(contractId);
        if (!contract) {
            return res.status(401).json({ message: "No se encuentra el contrato el ID especificado." });
        }
        applicationStatusId = applicationStatusId !== '0' && applicationStatusId !== 'null' ? applicationStatusId : null
        contract.update({
            application_status_id: applicationStatusId
        });
        res.status(200).json(contract);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const changeApplicant = async (req, res) => {
    try {
        let { contractId, applicantId } = req.params;
        const contract = await md.contracts.findByPk(contractId);
        if (!contract) {
            return res.status(401).json({ message: "No se encuentra el contrato el ID especificado." });
        }
        applicantId = applicantId !== '0' && applicantId !== 'null' ? applicantId : null
        contract.update({
            applicant_id: applicantId
        });
        res.status(200).json(contract);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const changeClientSupport = async (req, res) => {
    try {
        let { contractId, clientSupportId } = req.params;
        const contract = await md.contracts.findByPk(contractId);
        if (!contract) {
            return res.status(401).json({ message: "No se encuentra el contrato el ID especificado." });
        }
        clientSupportId = clientSupportId !== '0' && clientSupportId !== 'null' ? clientSupportId : null
        contract.update({
            client_support_id: clientSupportId
        });
        res.status(200).json(contract);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const changeResponsible = async (req, res) => {
    try {
        let { contractId, responsibleId } = req.params;
        const contract = await md.contracts.findByPk(contractId);
        if (!contract) {
            return res.status(401).json({ message: "No se encuentra el contrato el ID especificado." });
        }
        responsibleId = responsibleId !== '0' && responsibleId !== 'null' ? responsibleId : null
        contract.update({
            responsible_id: responsibleId
        });
        res.status(200).json(contract);
    }
    catch (error) {
        res.status(500).json({ message: error.message });
    }
}

const changeObservations = async (req, res) => {
    try {
        const { contractId } = req.params;
        let { observations } = req.body;
        const contract = await md.contracts.findByPk(contractId);
        if (!contract) {
            return res.status(401).json({ message: "No se encuentra el contrato el ID especificado." });
        }
        observations = observations !== 'null' ? observations : null;
        contract.update({
            observations: observations
        });
        res.status(200).json(contract);
    }
    catch (error) {
        console.log(error);
        res.status(500).json({ message: error.message });
    }
}

    module.exports = {
    getAll,
    changeApplicationStatus,
    changeApplicant,
    changeClientSupport,
    changeResponsible,
    changeObservations,    
}