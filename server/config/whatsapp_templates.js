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
    // Plantilla "brief_recibido": botón con URL https://<front>/brief/view/{{1}}
    nuevo_brief: {
        name: 'brief_recibido',
        languageCode: LANGUAGE_CODE,
        build: ({ brief }) => ({
            bodyParams: [brief.nombre_empresa, brief.nombre_campana],
            buttonParam: buildBriefCode(brief.id),
        }),
    },
};

module.exports = { TEMPLATES };
