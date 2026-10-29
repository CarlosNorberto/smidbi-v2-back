const md = require('../models');
const { verifyReportToken } = require('../utils/reportLink');

// Acceso por token a UN reporte, sin login: es lo que permite abrir la pantalla del reporte desde el botón del
// aviso de WhatsApp "reporte_creado" (/admin/report?token=...). El token (utils/reportLink.js) lleva dentro el
// id del reporte y viaja en el header estándar:
//
//     Authorization: ReportToken <token>
//
// (se usa Authorization y no un header propio porque CORS solo permite Content-Type y Authorization).
//
// Es de SOLO LECTURA y de alcance mínimo: se usa únicamente en las pocas rutas GET que consulta esa pantalla
// (ver routes/campaign_manager), y cada una comprueba que lo pedido pertenezca al reporte del token. Todo lo
// demás (guardar, borrar, subir imágenes, los demás reportes) sigue exigiendo sesión (`sessionAuth`).

const readToken = (req) => {
    const match = /^ReportToken\s+(\S+)$/i.exec(req.get('Authorization') || '');
    return match ? match[1] : null;
};

// Qué puede leer el token. Cada alcance recibe el id del reporte del token y la request.
const scopes = {
    // Catálogos sin datos de ningún reporte (lista de objetivos, de plataformas): vale cualquier token válido.
    catalog: async () => true,
    // La ruta tiene el id del reporte en un parámetro (ej. :id o :report_id): debe ser el del token.
    sameReport: (param) => async (reportId, req) => Number(req.params[param]) === reportId,
    // La ruta tiene el id de una campaña (:id): debe ser la campaña a la que pertenece el reporte del token.
    campaignOfReport: async (reportId, req) => (
        (await md.reportes.count({ where: { id: reportId, id_campana: Number(req.params.id) || 0 } })) > 0
    ),
};

/**
 * Deja pasar si hay sesión iniciada o si trae un token de reporte válido para este alcance. Con token sin
 * sesión, `req.reportAccess` queda con el id del reporte (los controllers lo usan para limitar lo que devuelven).
 */
const sessionOrReportToken = (scope) => async (req, res, next) => {
    if (req.isAuthenticated()) return next();
    try {
        const reportId = verifyReportToken(readToken(req));
        if (reportId && (await scope(reportId, req))) {
            req.reportAccess = reportId;
            return next();
        }
    } catch {
        // cualquier error cae al rechazo de abajo
    }
    res.status(403).send({ message: 'Acceso denegado. Por favor inicie sesión' });
};

module.exports = { sessionOrReportToken, scopes };
