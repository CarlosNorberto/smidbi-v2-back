const { buildBriefCode } = require('../utils/briefLink');

// Plantilla de WhatsApp que usa cada proceso (los procesos están en whatsapp_procesos.js).
//   name          nombre de la plantilla aprobada en Meta
//   languageCode  idioma con el que se registró la plantilla (WHATSAPP_TEMPLATE_LANG lo cambia para todas)
//   build(data)   arma las variables a partir de los datos que el proceso le pasa a notifyProceso:
//                   bodyParams   textos de {{1}}, {{2}}… del cuerpo, en orden
//                   buttonParam  texto de {{1}} del botón con URL dinámica (va al final de la URL)
// Las variables deben coincidir EXACTAMENTE (cantidad y orden) con las de la plantilla aprobada; si no,
// Meta rechaza el envío (error "parameters mismatch").
const LANGUAGE_CODE = process.env.WHATSAPP_TEMPLATE_LANG || 'es';

const TEMPLATES = {
    // Plantilla "brief_recibido": "Se recibió el formulario brief del cliente {{1}} y ya está disponible en el
    // sistema." + botón con URL https://<front>/brief/view/{{1}}
    nuevo_brief: {
        name: 'brief_recibido',
        languageCode: LANGUAGE_CODE,
        build: ({ brief }) => ({
            bodyParams: [brief.nombre_empresa],
            buttonParam: buildBriefCode(brief.id),
        }),
    },
};

// Plantilla "tarea_asignada" (aviso a los responsables de una tarea de /tasks). Texto sugerido para registrarla en Meta:
//   "Se te asignó la tarea {{1}} en el sistema. Puedes ver el detalle en el botón de abajo."
// + botón "Ver tarea" con URL dinámica:  https://<FRONT_URL>/admin/tasks/card/{{1}}   ({{1}} = id de la tarea)
// Quien abre el link debe iniciar sesión (es una pantalla interna); después de entrar, el sistema lo lleva a la tarea.
// No va ligada a un proceso con destinatarios fijos: se envía al teléfono de cada responsable (ver notifyUsuarios).
TEMPLATES.tarea_asignada = {
    name: 'tarea_asignada',
    languageCode: LANGUAGE_CODE,
    build: ({ tarea, cardId }) => ({
        bodyParams: [tarea],
        buttonParam: String(cardId),
    }),
};

module.exports = { TEMPLATES };
