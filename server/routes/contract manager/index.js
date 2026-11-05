const { sessionAuth, requireRole } = require('../../auth/middleware');
const { CONTRACT_MANAGER_ROLES } = require('../../auth/roles');
const contracts = require('../../controllers/contract_manager/contracts');
const signed_contracts = require('../../controllers/contract_manager/signed_contracts');
const application_status = require('../../controllers/contract_manager/application_status');
const company_form = require('../../controllers/contract_manager/company_form');
const multer = require('multer');

const contractFileFilter = (req, file, cb) => {
    const allowedMimes = [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    if (!allowedMimes.includes(file.mimetype)) {
        return cb(new Error('Solo se permiten archivos PDF, DOC o DOCX'), false);
    }
    cb(null, true);
};

const uploadContract = multer({
    storage: multer.memoryStorage(),
    fileFilter: contractFileFilter,
    limits: { fileSize: 10 * 1024 * 1024, files: 1 }, // 10 MB
});

module.exports = (app) => {
    // TODO el Gestor de Contratos (ver y administrar, incluido eliminar) es solo del rol "contracts" y de admin y
    // superadmin. Un usuario con otro rol no ve ni el menú ni los datos (ver auth/roles.js).
    const access = [sessionAuth, requireRole(...CONTRACT_MANAGER_ROLES)];

    // CONTRACTS
    app.get(process.env.PREFIX_API + '/contracts/all', ...access, contracts.getAll);
    app.get(process.env.PREFIX_API + '/contracts/one/:id', ...access, contracts.getById);
    app.patch(process.env.PREFIX_API + '/contracts/update/application_status/:contractId/:applicationStatusId', ...access, contracts.changeApplicationStatus);
    app.patch(process.env.PREFIX_API + '/contracts/update/applicant/:contractId/:applicantId', ...access, contracts.changeApplicant);
    app.patch(process.env.PREFIX_API + '/contracts/update/client_support/:contractId/:clientSupportId', ...access, contracts.changeClientSupport);
    app.patch(process.env.PREFIX_API + '/contracts/update/responsible/:contractId/:responsibleId', ...access, contracts.changeResponsible);
    app.patch(process.env.PREFIX_API + '/contracts/update/observations/:contractId', ...access, contracts.changeObservations);
    // Eliminar un contrato (con sus contratos firmados y el formulario de la empresa) es irreversible.
    app.delete(process.env.PREFIX_API + '/contracts/remove/:id', ...access, contracts.remove);

    // SIGNED CONTRACTS
    app.post(process.env.PREFIX_API + '/signed_contracts/upload/:contractId', ...access, uploadContract.single('file'), signed_contracts.uploadSignedContract);
    app.get(process.env.PREFIX_API + '/signed_contracts/signed/:contractId', ...access, signed_contracts.getSignedContracts);
    app.delete(process.env.PREFIX_API + '/signed_contracts/signed/remove/:contractId', ...access, signed_contracts.removeSignedContract);

    // APPLICATION STATUS
    app.get(process.env.PREFIX_API + '/application_status/all', ...access, application_status.getAll);
    app.post(process.env.PREFIX_API + '/application_status/save', ...access, application_status.save);
    app.put(process.env.PREFIX_API + '/application_status/update/:applicationStatusId', ...access, application_status.update);
    app.delete(process.env.PREFIX_API + '/application_status/remove/:applicationStatusId', ...access, application_status.remove);

    // COMPANY FORM
    app.get(process.env.PREFIX_API + '/company_form/one/:id', ...access, company_form.getById);
    app.post(process.env.PREFIX_API + '/company_form/create', ...access, company_form.create);
    app.put(process.env.PREFIX_API + '/company_form/update/:id', ...access, company_form.update);
    app.delete(process.env.PREFIX_API + '/company_form/remove/:id', ...access, company_form.remove);
    app.get(process.env.PREFIX_API + '/company_form/download/:companyFormId', ...access, company_form.downloadContract);

}
