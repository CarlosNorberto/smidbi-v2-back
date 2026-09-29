const { sessionAuth } = require('../../auth/middleware');
const performanceBranding = require('../../controllers/planificador/performance_branding');
const pdfPlanificador = require('../../controllers/planificador/pdf_planificador');

module.exports = (app) => {

    // PLANIFICADOR — COTIZACIÓN DE MEDIOS (performance_branding + summary)
    app.get(process.env.PREFIX_API + '/planificador/performance_branding/:id_brief/:grupo', sessionAuth, performanceBranding.getByBrief);
    app.post(process.env.PREFIX_API + '/planificador/performance_branding/save', sessionAuth, performanceBranding.saveBulk);

    // PLANIFICADOR — PDF DE LA PROPUESTA
    app.post(process.env.PREFIX_API + '/planificador/pdf/:id_brief/generate', sessionAuth, pdfPlanificador.generate);

    // PLANIFICADOR — VISTA PÚBLICA DE LA PROPUESTA (sin login, ver /propuesta/:token)
    app.get(process.env.PREFIX_API + '/planificador/pdf/token/:token', pdfPlanificador.getByToken);
    app.get(process.env.PREFIX_API + '/planificador/pdf/token/:token/file', pdfPlanificador.downloadByToken);
    app.put(process.env.PREFIX_API + '/planificador/pdf/token/:token/respuesta', pdfPlanificador.respondByToken);

};
