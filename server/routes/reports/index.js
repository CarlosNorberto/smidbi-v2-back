const { sessionAuth, requireRole } = require('../../auth/middleware');
const reports = require('../../controllers/reports');

module.exports = (app) => {

    // REPORTES (acceso exclusivo para admin y superadmin)
    // Los reportes los arma el backend (server/reports/); estas rutas son genéricas:
    // agregar un reporte nuevo no requiere tocar este archivo.
    const guard = [sessionAuth, requireRole('admin', 'superadmin')];
    app.get(process.env.PREFIX_API + '/reports/catalog', ...guard, reports.getCatalog);
    app.get(process.env.PREFIX_API + '/reports/:id/export', ...guard, reports.exportExcel);
    app.get(process.env.PREFIX_API + '/reports/:id', ...guard, reports.run);
};
