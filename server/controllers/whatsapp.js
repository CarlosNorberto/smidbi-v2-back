const { sendTemplateMessage, sendTextMessage } = require('../services/whatsappService');

/**
 * POST /whatsapp/send — endpoint de prueba para enviar mensajes por WhatsApp.
 * Body:
 *  - to (obligatorio): número sin '+' (ej: '59167146124')
 *  - type: 'template' (default) | 'text'
 *  - template: { name, languageCode, components } (type 'template'; default hello_world / en_US)
 *  - body: texto (type 'text')
 */
const send = async (req, res) => {
    const { to, type = 'template', template = {}, body } = req.body || {};

    if (!to || !/^\d{8,15}$/.test(String(to))) {
        return res.status(400).send({ message: "'to' es obligatorio: solo dígitos, con código de país y sin '+'" });
    }

    try {
        let data;
        if (type === 'text') {
            if (!body) return res.status(400).send({ message: "'body' es obligatorio para type 'text'" });
            data = await sendTextMessage(String(to), body);
        } else if (type === 'template') {
            data = await sendTemplateMessage(
                String(to),
                template.name || 'hello_world',
                template.languageCode || 'en_US',
                template.components || [],
            );
        } else {
            return res.status(400).send({ message: "type debe ser 'template' o 'text'" });
        }
        res.status(200).send(data);
    } catch (error) {
        res.status(502).send({ message: error.message });
    }
};

module.exports = { send };
