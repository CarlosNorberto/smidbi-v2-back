const { sessionAuth } = require('../../auth/middleware');
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

    // CONTRACTS
    app.get(process.env.PREFIX_API + '/contracts/all', sessionAuth, contracts.getAll);
    app.patch(process.env.PREFIX_API + '/contracts/update/application_status/:contractId/:applicationStatusId', sessionAuth, contracts.changeApplicationStatus);
    app.patch(process.env.PREFIX_API + '/contracts/update/applicant/:contractId/:applicantId', sessionAuth, contracts.changeApplicant);
    app.patch(process.env.PREFIX_API + '/contracts/update/client_support/:contractId/:clientSupportId', sessionAuth, contracts.changeClientSupport);
    app.patch(process.env.PREFIX_API + '/contracts/update/responsible/:contractId/:responsibleId', sessionAuth, contracts.changeResponsible);
    app.patch(process.env.PREFIX_API + '/contracts/update/observations/:contractId', sessionAuth, contracts.changeObservations);        

    // SIGNED CONTRACTS
    app.post(process.env.PREFIX_API + '/signed_contracts/upload/:contractId', sessionAuth, uploadContract.single('file'), signed_contracts.uploadSignedContract);
    app.get(process.env.PREFIX_API + '/signed_contracts/signed/:contractId', sessionAuth, signed_contracts.getSignedContracts);
    app.delete(process.env.PREFIX_API + '/signed_contracts/signed/remove/:contractId', sessionAuth, signed_contracts.removeSignedContract);

    // APPLICATION STATUS
    app.get(process.env.PREFIX_API + '/application_status/all', sessionAuth, application_status.getAll);
    app.post(process.env.PREFIX_API + '/application_status/save', sessionAuth, application_status.save);
    app.put(process.env.PREFIX_API + '/application_status/update/:applicationStatusId', sessionAuth, application_status.update);
    app.delete(process.env.PREFIX_API + '/application_status/remove/:applicationStatusId', sessionAuth, application_status.remove);
    
    // COMPANY FORM
    app.get(process.env.PREFIX_API + '/company_form/one/:id', sessionAuth, company_form.getById);
    app.post(process.env.PREFIX_API + '/company_form/create', sessionAuth, company_form.create);
    app.put(process.env.PREFIX_API + '/company_form/update/:id', sessionAuth, company_form.update);
    app.delete(process.env.PREFIX_API + '/company_form/remove/:id', sessionAuth, company_form.remove);
    app.get(process.env.PREFIX_API + '/company_form/download/:companyFormId', sessionAuth, company_form.downloadContract);

}