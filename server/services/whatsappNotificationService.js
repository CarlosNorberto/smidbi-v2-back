const { sendTemplateMessage } = require('./whatsappService');
const { getTelefonosByProceso } = require('./whatsappDestinatariosService');
const { TEMPLATES } = require('../config/whatsapp_templates');
const { logEvent } = require('./systemEventService');

// Meta rechaza variables con saltos de línea, tabulaciones o más de 4 espacios seguidos, y limita el largo.
const cleanParam = (value) => String(value ?? '')
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/ {2,}/g, ' ')
    .trim()
    .slice(0, 1024) || '-';

// Arma el arreglo `components` que espera la API de Meta.
const buildComponents = ({ bodyParams = [], buttonParam } = {}) => {
    const components = [];
    if (bodyParams.length > 0) {
        components.push({
            type: 'body',
            parameters: bodyParams.map((text) => ({ type: 'text', text: cleanParam(text) })),
        });
    }
    if (buttonParam !== undefined && buttonParam !== null) {
        components.push({
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: String(buttonParam) }],
        });
    }
    return components;
};

/**
 * Envía el aviso de un proceso a todos los números activos suscritos a él (Administración >
 * Configuraciones > Notificaciones WhatsApp), usando la plantilla de ese proceso (ver
 * config/whatsapp_templates.js).
 *
 * Nunca lanza error: un fallo de WhatsApp no debe romper el proceso que lo llama (por ejemplo, guardar el
 * brief del cliente). Devuelve un resumen y deja los fallos en el log.
 *
 * Uso (sin await si no hace falta esperar el resultado):
 *   notifyProceso('nuevo_brief', { brief });
 *
 * @param {string} proceso - key del proceso (ver config/whatsapp_procesos.js)
 * @param {object} data - datos que necesita la plantilla del proceso para armar sus variables
 * @returns {Promise<{ proceso: string, enviados: number, fallidos: number, errores: string[] }>}
 */
const notifyProceso = async (proceso, data = {}) => {
    const summary = { proceso, enviados: 0, fallidos: 0, errores: [] };
    try {
        const template = TEMPLATES[proceso];
        if (!template) throw new Error(`El proceso "${proceso}" no tiene una plantilla configurada`);

        const telefonos = await getTelefonosByProceso(proceso);
        if (telefonos.length === 0) return summary;

        const components = buildComponents(template.build(data));
        const results = await Promise.allSettled(
            telefonos.map((to) => sendTemplateMessage(to, template.name, template.languageCode, components)),
        );

        results.forEach((result, i) => {
            if (result.status === 'fulfilled') {
                summary.enviados += 1;
            } else {
                summary.fallidos += 1;
                summary.errores.push(`${telefonos[i]}: ${result.reason.message}`);
            }
        });
    } catch (error) {
        summary.errores.push(error.message);
    }

    if (summary.errores.length > 0) {
        console.error(`[WhatsApp] Aviso "${proceso}" con errores:`, summary.errores);
        logEvent({
            category: 'whatsapp',
            source: proceso,
            message: `Aviso "${proceso}": ${summary.fallidos} fallido(s), ${summary.enviados} enviado(s)`,
            detail: { errores: summary.errores },
        });
    }
    return summary;
};

/**
 * Envía una plantilla a una lista de personas concretas (p. ej. los responsables de una tarea), cada una a su propio
 * teléfono y con sus propios datos. Nunca lanza error. Quien no tiene teléfono se reporta en `sinTelefono`.
 *
 * @param {string} templateKey - clave en config/whatsapp_templates.js
 * @param {Array<{ nombre: string, telefono: string|null, data: object }>} recipients
 * @returns {Promise<{ enviados: number, fallidos: number, sinTelefono: string[], errores: string[] }>}
 */
const notifyUsuarios = async (templateKey, recipients = []) => {
    const summary = { enviados: 0, fallidos: 0, sinTelefono: [], errores: [] };
    const template = TEMPLATES[templateKey];
    if (!template) {
        summary.errores.push(`La plantilla "${templateKey}" no está configurada`);
        return summary;
    }

    const withPhone = [];
    for (const r of recipients) {
        const to = String(r.telefono ?? '').replace(/\D/g, '');
        if (/^\d{8,15}$/.test(to)) withPhone.push({ ...r, to });
        else summary.sinTelefono.push(r.nombre);
    }

    const results = await Promise.allSettled(
        withPhone.map((r) => sendTemplateMessage(
            r.to,
            template.name,
            template.languageCode,
            buildComponents(template.build({ nombre: r.nombre, ...r.data })),
        )),
    );
    results.forEach((result, i) => {
        if (result.status === 'fulfilled') {
            summary.enviados += 1;
        } else {
            summary.fallidos += 1;
            summary.errores.push(`${withPhone[i].nombre}: ${result.reason.message}`);
        }
    });
    if (summary.errores.length > 0) {
        console.error(`[WhatsApp] Aviso "${templateKey}" con errores:`, summary.errores);
        logEvent({
            category: 'whatsapp',
            source: templateKey,
            message: `Aviso "${templateKey}": ${summary.fallidos} fallido(s), ${summary.enviados} enviado(s)`,
            detail: { errores: summary.errores },
        });
    }
    return summary;
};

module.exports = { notifyProceso, notifyUsuarios, buildComponents };
