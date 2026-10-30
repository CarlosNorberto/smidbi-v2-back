const { sendTemplateMessage } = require('./whatsappService');
const { getTelefonosByProceso } = require('./whatsappDestinatariosService');
const { logEvent } = require('./systemEventService');

// Proceso "Nuevo contrato generado" (config/whatsapp_procesos.js): los números se eligen en
// Configuraciones > Notificaciones WhatsApp > "Recibe avisos de".
const CONTRACTS_PROCESO = 'nuevo_contrato';

/**
 * Envía una plantilla de WhatsApp a todos los números activos suscritos al proceso de contratos.
 * Si un número falla, no interrumpe el envío al resto.
 * @param {string} templateName - Nombre de la plantilla aprobada (ej: 'hello_world')
 * @param {string} languageCode - Código de idioma de la plantilla (ej: 'en_US')
 * @param {Array} components - Parámetros dinámicos de la plantilla (opcional)
 * @returns {Promise<Array<{ to: string, status: 'fulfilled'|'rejected', data?: any, error?: string }>>}
 */
const notifyContractsWhatsapp = async (templateName, languageCode = 'en_US', components = []) => {
    const numbers = await getTelefonosByProceso(CONTRACTS_PROCESO);
    if (numbers.length === 0) {
        console.warn('No hay números suscritos al proceso "nuevo_contrato" en Notificaciones WhatsApp');
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
        logEvent({ category: 'whatsapp', source: CONTRACTS_PROCESO, message: `No se pudo avisar a ${to}: ${result.reason.message}`, detail: { plantilla: templateName } });
        return { to, status: 'rejected', error: result.reason.message };
    });
};

module.exports = { notifyContractsWhatsapp };
