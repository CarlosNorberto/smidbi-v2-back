const md = require('../models');
const { notifyProceso } = require('./whatsappNotificationService');
const { getTelefonosByProceso } = require('./whatsappDestinatariosService');
const { buildReportToken } = require('../utils/reportLink');

/**
 * Avisa por WhatsApp ("reporte_creado") que se creó un reporte nuevo, a los números suscritos al proceso
 * "Nuevo reporte creado" (Configuraciones > Notificaciones WhatsApp).
 *
 * Es invisible para quien crea el reporte:
 *  - si ningún número está suscrito, no hace nada (ni consulta datos ni escribe en el log);
 *  - nunca lanza error: cualquier fallo (WhatsApp caído, plantilla mal configurada...) queda solo en el log
 *    del servidor, y el reporte se guarda igual.
 *
 * Se llama SIN await desde el guardado del reporte, ya con la transacción confirmada.
 *
 * @param {number} reportId - id del reporte recién creado
 */
const notifyReportCreated = async (reportId) => {
    try {
        const telefonos = await getTelefonosByProceso('nuevo_reporte');
        if (telefonos.length === 0) return;

        const report = await md.reportes.findByPk(reportId, { attributes: ['id', 'nombre'] });
        if (!report) return;

        await notifyProceso('nuevo_reporte', {
            reporte: report.nombre,
            token: buildReportToken(report.id),
        });
    } catch (error) {
        console.error('[WhatsApp] No se pudo enviar el aviso de reporte creado:', error.message);
    }
};

module.exports = { notifyReportCreated };
