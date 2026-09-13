const { sessionAuth } = require('../../auth/middleware');
const performanceBranding = require('../../controllers/planificador/performance_branding');

module.exports = (app) => {

    // PLANIFICADOR — COTIZACIÓN DE MEDIOS (performance_branding + summary)
    app.get(process.env.PREFIX_API + '/planificador/performance_branding/:id_brief/:grupo', sessionAuth, performanceBranding.getByBrief);
    app.post(process.env.PREFIX_API + '/planificador/performance_branding/save', sessionAuth, performanceBranding.saveBulk);

};
