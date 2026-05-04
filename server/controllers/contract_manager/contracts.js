const md = require('../../models');
const cloudinary = require('cloudinary').v2;
const path = require('path');

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
            limit,
            offset,
            order: [['create_date', 'DESC']]
        });
        res.status(200).json(contracts);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los contratos: ${error.message}` });
    }
}

const changeApplicationStatus = async (req,res)=>{
    try {
        let {contractId, applicationStatusId} = req.params;
        const contract = await md.contracts.findByPk(contractId);
        if (!contract) {
            return res.status(401).json({ message: "No se encuentra el contrato el ID especificado." });
        }
        applicationStatusId = applicationStatusId !== '0' ? applicationStatusId : null
        contract.update({
            application_status_id: applicationStatusId
        });
        res.status(200).json(contract);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getAll,
    changeApplicationStatus
}