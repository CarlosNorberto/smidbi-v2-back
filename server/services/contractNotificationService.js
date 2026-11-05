const md = require('../models');
const { notifyProceso } = require('./whatsappNotificationService');
const { generateContractCode, getFechaActualLaPaz } = require('../helps');

/**
 * Avisa por WhatsApp ("generated_contract") que se generó un contrato nuevo, a los números suscritos al proceso
 * "Nuevo contrato generado" (Configuraciones > Notificaciones WhatsApp > "Recibe avisos de").
 *
 * Es invisible para quien crea el contrato:
 *  - si ningún número está suscrito, no envía nada (notifyProceso no escribe en el log en ese caso);
 *  - nunca lanza error: cualquier fallo (WhatsApp caído, plantilla mal configurada...) queda en el registro de
 *    errores (categoría "whatsapp") y el contrato se guarda igual.
 *
 * Se llama SIN await desde la creación del contrato, ya con la transacción confirmada.
 *
 * @param {number} contractId - id del contrato recién creado
 */
const notifyContractCreated = async (contractId) => {
    try {
        const contract = await md.contracts.findByPk(contractId, {
            attributes: ['id', 'application_date', 'create_date'],
            raw: true,
        });
        if (!contract) return;

        await notifyProceso('nuevo_contrato', {
            contractId: contract.id,
            code: generateContractCode(contract.application_date || contract.create_date, contract.id),
            // application_date es una columna `date`: llega como AAAA-MM-DD
            date: contract.application_date ? String(contract.application_date).slice(0, 10) : getFechaActualLaPaz(),
        });
    } catch (error) {
        console.error('[WhatsApp] No se pudo enviar el aviso de contrato generado:', error.message);
    }
};

module.exports = { notifyContractCreated };
