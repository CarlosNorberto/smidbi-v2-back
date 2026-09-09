const axios = require('axios');

const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID;
const API_VERSION = process.env.WHATSAPP_API_VERSION || 'v21.0';

const BASE_URL = `https://graph.facebook.com/${API_VERSION}/${PHONE_NUMBER_ID}/messages`;

const client = axios.create({
    baseURL: BASE_URL,
    headers: {
        Authorization: `Bearer ${WHATSAPP_TOKEN}`,
        'Content-Type': 'application/json',
    },
});

/**
 * Envía un mensaje de plantilla de WhatsApp.
 * @param {string} to - Número del destinatario, sin '+' (ej: '59167146124')
 * @param {string} templateName - Nombre de la plantilla aprobada (ej: 'hello_world')
 * @param {string} languageCode - Código de idioma de la plantilla (ej: 'en_US')
 * @param {Array} components - Parámetros dinámicos de la plantilla (opcional)
 */
const sendTemplateMessage = async (
    to,
    templateName,
    languageCode = 'en_US',
    components = [],
) => {
    const payload = {
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
            name: templateName,
            language: { code: languageCode },
            ...(components.length > 0 && { components }),
        },
    };

    try {
        const response = await client.post('', payload);
        return response.data;
    } catch (error) {
        const detail = error.response?.data || error.message;
        console.error('Error enviando mensaje de WhatsApp:', detail);
        throw new Error(`Fallo al enviar WhatsApp: ${JSON.stringify(detail)}`);
    }
};

module.exports = { sendTemplateMessage };
