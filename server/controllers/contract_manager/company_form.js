const md = require('../../models');
const { generateContractCode, parseToDate } = require('../../helps');
const { sequelize } = require('../../models');
const { toZonedTime } = require('date-fns-tz');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const companyForm = await md.company_form.findByPk(id);
        if (!companyForm) {
            return res.status(404).json({ message: 'Formulario de empresa no encontrado' });
        }
        res.status(200).json(companyForm);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el formulario de la empresa: ${error.message}` });
    }
}

const create = async (req, res) => {
    try {
        const body = req.body;                
        const newCompanyForm = await md.company_form.create(body);
        const nowLaPaz = toZonedTime(new Date(), 'America/La_Paz');
        const startDate = parseToDate(newCompanyForm.start_date_packs_pauta || newCompanyForm.start_date_traffickers || newCompanyForm.start_date_consulting || newCompanyForm.start_date_analitica || newCompanyForm.start_date_seo);
        const endDate = parseToDate(newCompanyForm.end_date_packs_pauta || newCompanyForm.end_date_traffickers || newCompanyForm.end_date_consulting || newCompanyForm.end_date_analitica || newCompanyForm.end_date_seo);
        await md.contracts.create({
            company_form_id: newCompanyForm.id,            
            application_date: nowLaPaz,
            start_date: startDate,
            end_date: endDate,
            code: generateContractCode(nowLaPaz, newCompanyForm.id),
        });
        res.status(201).json(newCompanyForm);
    } catch (error) {
        res.status(500).json({ message: `Error al crear el formulario de la empresa: ${error.message}` });
    }
}

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const body = req.body;
        const updatedCompanyForm = await md.company_form.update(body, { where: { id: id } });
        await md.contracts.update({
            start_date: parseToDate(body.start_date_packs_pauta || body.start_date_traffickers || body.start_date_consulting || body.start_date_analitica || body.start_date_seo),
            end_date: parseToDate(body.end_date_packs_pauta || body.end_date_traffickers || body.end_date_consulting || body.end_date_analitica || body.end_date_seo),
        }, { where: { company_form_id: id } });
        res.status(200).json(updatedCompanyForm);
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar el formulario de la empresa: ${error.message}` });
    }
}

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const companyForm = await md.company_form.findByPk(id);
        if (!companyForm) {
            return res.status(404).json({ message: 'Formulario de empresa no encontrado' });
        }
        await companyForm.destroy();
        res.status(200).json({ message: 'Formulario de empresa eliminado correctamente' });
    } catch (error) {
        res.status(500).json({ message: `Error al eliminar el formulario de la empresa: ${error.message}` });
    }
}

const generateContract = async (companyForm) => {
    const auth = new GoogleAuth({
        keyFile: './server/controllers/contract_manager/google-credentials.json',
        scopes: ['https://www.googleapis.com/auth/documents',
            'https://www.googleapis.com/auth/drive']
    });
    const drive = google.drive({ version: 'v3', auth });

    const TEMPLATE_PACKS_PAUTA_ID = '1xfqsAgKbkbg4yAbTDRT14fdZLX3eSf4D13rgL4FpCqw';
    const TEMPLATE_TRAFFICKERS_ID = '1UdSpuD2QQ0wmTb4IkCSUp_Lq0izWp5jfEDgOutdO5xk';
    const TEMPLATE_SEO_ID = '141ZVPmz5Cn7BiD6ranFLWJ1C27SyRnscDVQ6g-WhxOI';

    const templateName = companyForm.packs_pauta ? 'PACKS_PAUTA' : companyForm.traffickers ? 'TRAFFICKERS' : companyForm.consulting ? 'SEO' : null;

    let templateId = '';
    if(templateName.toString().toUpperCase() === 'PACKS_PAUTA'){
        templateId = TEMPLATE_PACKS_PAUTA_ID;
    }else if(templateName.toString().toUpperCase() === 'TRAFFICKERS'){
        templateId = TEMPLATE_TRAFFICKERS_ID;
    }else if(templateName.toString().toUpperCase() === 'SEO'){
        templateId = TEMPLATE_SEO_ID;
    }else{
        throw new Error('Nombre de plantilla (template_name) no válido');
    }

    const response = await drive.files.export({
        fileId: templateId,
        mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }, { responseType: 'arraybuffer' });

    // 2. Cargar el documento con Docxtemplater
    const zip = new PizZip(response.data);

    const doc = new Docxtemplater(zip, {
        paragraphLoop: true,
        linebreaks: true,
        delimiters: {
            start: '{{',
            end: '}}'
        }
    });

    // Buscar el contrato
    const contract = await md.contracts.findOne({
        where: {
            company_form_id: companyForm.id
        },
        attributes: ['id', 'application_date']
    });
    // extraer el año de la fecha de aplicación
    if (!contract) {
        throw new Error('Contrato no encontrado con el CODIGO proporcionado');
    }    

    // 3. Reemplazar las variables (sin {{}} en las claves)    
    const dato_to_replace = {
        ALCANCE: companyForm.packs_pauta ? companyForm.scope_of_service_packs_pauta : companyForm.traffickers ? companyForm.scope_of_service_traffickers : companyForm.consulting ? companyForm.scope_of_service_consulting : companyForm.analitica ? companyForm.scope_of_service_analitica : companyForm.seo ? companyForm.scope_of_service_seo : null,
        DURACION: `El Contrato tendrá una duración de ${companyForm.duration_packs_pauta}, entrará en vigencia a partir del ${companyForm.start_date_packs_pauta} hasta el ${companyForm.end_date_packs_pauta}.`.replace(/\s+/g, ' '),
        CODIGO: generateContractCode(contract.application_date, contract.id),
    }

    doc.setData(dato_to_replace);
    doc.render();

    // 4. Generar el buffer del documento
    const buffer = doc.getZip().generate({ 
      type: 'nodebuffer',
      compression: 'DEFLATE'
    });

    console.log('Contrato generado exitosamente');
    return buffer;
}

const downloadContract = async (req, res) => {
    try {
        const {companyFormId} = req.params;

        const companyForm = await md.company_form.findByPk(companyFormId);
        if(!companyForm){
            return res.status(400).json({ error: 'Formulario de empresa no encontrado' });
        }

        const buffer = await generateContract(companyForm);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=contrato_${companyForm.company_name}.docx`);
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Error generando contrato' });
    }
}

module.exports = {
    getById,
    create,
    update,
    remove,
    downloadContract
}