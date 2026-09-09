const md = require('../models');
const { sendTemplateMessage } = require('./whatsappService');

const CONTRACTS_MODULE = 'contracts';
const WHATSAPP_NUMBERS_KEY = 'whatsapp_notification_numbers';

/**
 * Obtiene los números configurados en system_settings para notificaciones
 * de WhatsApp del módulo de contratos (module: 'contracts', key: 'whatsapp_notification_numbers').
 */
const getContractsNotificationNumbers = async () => {
    const setting = await md.system_settings.findOne({
        where: { module: CONTRACTS_MODULE, key: WHATSAPP_NUMBERS_KEY, active: true },
    });
    if (!setting || !Array.isArray(setting.value)) {
        return [];
    }
    return setting.value;
};

/**
 * Envía una plantilla de WhatsApp a todos los números configurados para
 * notificaciones del módulo de contratos. Si un número falla, no interrumpe
 * el envío al resto.
 * @param {string} templateName - Nombre de la plantilla aprobada (ej: 'hello_world')
 * @param {string} languageCode - Código de idioma de la plantilla (ej: 'en_US')
 * @param {Array} components - Parámetros dinámicos de la plantilla (opcional)
 * @returns {Promise<Array<{ to: string, status: 'fulfilled'|'rejected', data?: any, error?: string }>>}
 */
const notifyContractsWhatsapp = async (templateName, languageCode = 'en_US', components = []) => {
    const numbers = await getContractsNotificationNumbers();
    if (numbers.length === 0) {
        console.warn('No hay números configurados en system_settings para notificaciones de WhatsApp de contratos');
        return [];
    }

    const results = await Promise.allSettled(
        numbers.map((to) => sendTemplateMessage(to, templateName, languageCode, components)),
    );

    return results.map((result, index) => {
        const to = numbers[index];
        if (result.status === 'fulfilled') {
            return { to, status: 'fulfilled', data: result.value };
        }
        console.error(`Error notificando por WhatsApp a ${to}:`, result.reason.message);
        return { to, status: 'rejected', error: result.reason.message };
    });
};

module.exports = { getContractsNotificationNumbers, notifyContractsWhatsapp };
