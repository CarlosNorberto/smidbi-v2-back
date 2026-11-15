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

// Plantilla "reporte_creado" (proceso "Nuevo reporte creado"), registrada en Meta con UNA variable:
//   "Se generó el reporte {{1}} y ya está disponible en el sistema. Puedes consultarlo en el botón de abajo."
// + botón con URL dinámica:  https://<FRONT_URL>/admin/report?token={{1}}
//   ({{1}} del botón = token firmado que lleva dentro el id del reporte; ver utils/reportLink.js).
// El link abre la pantalla del reporte en modo SOLO LECTURA sin iniciar sesión (si ya hay sesión, abre la
// edición normal). Las variables deben coincidir EXACTAMENTE (cantidad y orden) con las de la plantilla
// aprobada en Meta: si cambia el texto, hay que ajustar `build` acá.
TEMPLATES.nuevo_reporte = {
    name: 'reporte_creado',
    languageCode: LANGUAGE_CODE,
    build: ({ reporte, token }) => ({
        bodyParams: [reporte],
        buttonParam: token,
    }),
};

// Plantilla "tarea_asignada" (aviso a los responsables de una tarea de /tasks). Texto sugerido para registrarla en Meta:
//   "Se te asignó la tarea {{1}} en el sistema. Puedes ver el detalle en el botón de abajo."
// + botón "Ver tarea" con URL dinámica:  https://<FRONT_URL>/admin/tasks/card/{{1}}   ({{1}} = id de la tarea)
// OJO al registrarla en Meta: la URL del botón debe terminar en UN solo {{1}} y nada después. Si se registró mal, el link llega con el
// marcador literal antes del id (…/card/%7B%7B1%7D%7D11417); la pantalla de tareas ya lo tolera (toma el número del final), pero conviene corregirla.
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

// Plantilla "generated_contract" (proceso "Nuevo contrato generado"), registrada en Meta con variables CON NOMBRE:
//   "Hola, el contrato con código {{code}} fue generado en fecha {{date}} en el gestor de contratos."
//   code (ej. ABC-123)  = código del contrato (ADM-CTR-<año>-<id>)
//   date (ej. 2026-10-01) = fecha de solicitud, AAAA-MM-DD
// + botón con URL dinámica:  https://v2.smidbi.site/admin/contract_manager/{{1}}   ({{1}} = id del contrato)
// Quien abre el link debe iniciar sesión y tener acceso al Gestor de Contratos; después de entrar, el sistema lo lleva
// al detalle del contrato. Los nombres de las variables (code, date) deben ser EXACTAMENTE los de la plantilla aprobada.
TEMPLATES.nuevo_contrato = {
    name: 'generated_contract',
    languageCode: LANGUAGE_CODE,
    build: ({ code, date, contractId }) => ({
        bodyParams: [
            { name: 'code', text: code },
            { name: 'date', text: date },
        ],
        buttonParam: String(contractId),
    }),
};

module.exports = { TEMPLATES };
