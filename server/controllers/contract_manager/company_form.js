const md = require('../../models');
const { generateContractCode, parseToDate } = require('../../helps');
const { toZonedTime } = require('date-fns-tz');
const { google } = require('googleapis');
const { GoogleAuth } = require('google-auth-library');
const PizZip = require('pizzip');
const Docxtemplater = require('docxtemplater');
const { deleteContract } = require('../../services/contractService');
const { notifyContractCreated } = require('../../services/contractNotificationService');

// Tipo de servicio del formulario -> sufijo de sus campos (start_date_<sufijo>, duration_<sufijo>...).
// En el formulario "Servicio de Consultoría" (consulting) se divide en Analítica, SEO o Personalizada, y cada una
// guarda sus propios datos. Si un registro quedó con varios marcados (al cambiar de tipo en el formulario quedan
// valores viejos), manda el primero en este orden.
const serviceSuffix = (data) => {
    if (data.packs_pauta) return 'packs_pauta';
    if (data.traffickers) return 'traffickers';
    if (data.consulting) {
        if (data.analitica) return 'analitica';
        if (data.seo) return 'seo';
        return 'consulting';
    }
    return null; // adenda u otro: no tiene fechas de servicio
};

// Fechas de inicio y fin del servicio, las que se copian al contrato.
const serviceDates = (data) => {
    const suffix = serviceSuffix(data);
    if (!suffix) return { start: null, end: null };
    return { start: parseToDate(data[`start_date_${suffix}`]), end: parseToDate(data[`end_date_${suffix}`]) };
};

// El id y el contrato los fija el servidor: nunca se toman del cuerpo de la petición.
const cleanBody = (body) => {
    const { id, contract_id, ...rest } = body || {};
    return rest;
};

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

// Crea el formulario de la empresa Y su contrato. Van en una transacción: antes, si fallaba la creación del contrato
// quedaba un formulario suelto (hay 46 así en la base). Responde con el formulario y el id del contrato creado.
const create = async (req, res) => {
    try {
        const body = cleanBody(req.body);
        if (!body.company_name || !String(body.company_name).trim()) {
            return res.status(400).json({ message: 'El nombre de la empresa es obligatorio.' });
        }
        const nowLaPaz = toZonedTime(new Date(), 'America/La_Paz');
        const { companyForm, contract } = await md.sequelize.transaction(async (transaction) => {
            const companyForm = await md.company_form.create(body, { transaction });
            const { start, end } = serviceDates(companyForm);
            const contract = await md.contracts.create({
                company_form_id: companyForm.id,
                application_date: nowLaPaz,
                start_date: start,
                end_date: end,
            }, { transaction });
            return { companyForm, contract };
        });
        // Aviso por WhatsApp a los números suscritos a "Nuevo contrato generado". Sin await y ya con la transacción
        // confirmada: nunca lanza error ni demora la respuesta (ver services/contractNotificationService.js).
        notifyContractCreated(contract.id);
        res.status(201).json({ ...companyForm.toJSON(), contract_id: contract.id });
    } catch (error) {
        res.status(500).json({ message: `Error al crear el formulario de la empresa: ${error.message}` });
    }
}

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const body = cleanBody(req.body);
        const companyForm = await md.company_form.findByPk(id);
        if (!companyForm) {
            return res.status(404).json({ message: 'Formulario de empresa no encontrado' });
        }
        await md.sequelize.transaction(async (transaction) => {
            await companyForm.update(body, { transaction });
            const { start, end } = serviceDates(companyForm);
            await md.contracts.update(
                { start_date: start, end_date: end, write_date: new Date() },
                { where: { company_form_id: companyForm.id }, transaction }
            );
        });
        res.status(200).json(companyForm);
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar el formulario de la empresa: ${error.message}` });
    }
}

// Elimina el formulario junto con su contrato y los contratos firmados (ver services/contractService.js). Si el
// formulario no tiene contrato (los hay por datos anteriores), solo se borra el formulario.
const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const companyForm = await md.company_form.findByPk(id);
        if (!companyForm) {
            return res.status(404).json({ message: 'Formulario de empresa no encontrado' });
        }
        const contracts = await md.contracts.findAll({ where: { company_form_id: id }, attributes: ['id'], raw: true });
        for (const contract of contracts) {
            await deleteContract(contract.id);
        }
        // Si el formulario aún existe (no tenía contrato), se borra aquí.
        await md.company_form.destroy({ where: { id } });
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

    // Solo hay plantillas de Word para Packs de Pauta, Traffickers y Consultoría (que usa la de SEO para sus tres
    // tipos: Analítica, SEO y Personalizada). Una Adenda no tiene plantilla: se avisa con un mensaje claro.
    const suffix = serviceSuffix(companyForm);
    const templateId = suffix === 'packs_pauta' ? TEMPLATE_PACKS_PAUTA_ID
        : suffix === 'traffickers' ? TEMPLATE_TRAFFICKERS_ID
        : suffix ? TEMPLATE_SEO_ID
        : null;
    if (!templateId) {
        const error = new Error('Este tipo de servicio (Adenda) no tiene una plantilla de contrato para generar.');
        error.status = 400;
        throw error;
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
        attributes: ['id', 'application_date', 'create_date']
    });
    // extraer el año de la fecha de aplicación
    if (!contract) {
        throw new Error('Contrato no encontrado con el CODIGO proporcionado');
    }    

    // 3. Reemplazar las variables (sin {{}} en las claves)    
    // Alcance, duración y fechas son los del tipo de servicio del contrato (antes la duración y las fechas salían
    // siempre de "Packs de Pauta": en los demás servicios el documento decía "duración de null ... a partir del null").
    const dato_to_replace = {
        ALCANCE: companyForm[`scope_of_service_${suffix}`] ?? '',
        DURACION: `El Contrato tendrá una duración de ${companyForm[`duration_${suffix}`] ?? ''}, entrará en vigencia a partir del ${companyForm[`start_date_${suffix}`] ?? ''} hasta el ${companyForm[`end_date_${suffix}`] ?? ''}.`.replace(/\s+/g, ' '),
        CODIGO: generateContractCode(contract.application_date || contract.create_date, contract.id),
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
            return res.status(404).json({ message: 'Formulario de empresa no encontrado' });
        }

        const buffer = await generateContract(companyForm);

        // Nombre de archivo sin espacios ni caracteres raros (van dentro de una cabecera HTTP).
        const safeName = String(companyForm.company_name || 'empresa').trim().replace(/[^\w.-]+/g, '_');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
        res.setHeader('Content-Disposition', `attachment; filename=contrato_${safeName}.docx`);
        res.send(Buffer.from(buffer));

    } catch (error) {
        console.error(error);
        // La petición se hace como "blob": el frontend lee `message` de la respuesta si viene en JSON.
        res.status(error.status || 500).json({ message: error.status ? error.message : 'Error generando contrato' });
    }
}

module.exports = {
    getById,
    create,
    update,
    remove,
    downloadContract
}