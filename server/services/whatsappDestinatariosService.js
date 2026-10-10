const md = require('../models');

/**
 * Números de WhatsApp activos suscritos a un proceso (ver server/config/whatsapp_procesos.js).
 * Es lo que usa cada proceso del sistema para saber a quién avisar:
 *
 *   const telefonos = await getTelefonosByProceso('nuevo_brief');
 *   await Promise.allSettled(telefonos.map((to) => sendTemplateMessage(to, ...)));
 *
 * @param {string} proceso - key del proceso (ej. 'nuevo_brief')
 * @returns {Promise<string[]>} teléfonos en formato Meta (solo dígitos, con código de país)
 */
const getTelefonosByProceso = async (proceso) => {
    const destinatarios = await md.whatsapp_destinatarios.findAll({
        where: { activo: true },
        attributes: ['telefono', 'procesos'],
    });
    return destinatarios.filter((d) => d.procesos.includes(proceso)).map((d) => d.telefono);
};

module.exports = { getTelefonosByProceso };
