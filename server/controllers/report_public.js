const md = require('../models');
const { verifyReportToken } = require('../utils/reportLink');

// Resuelve el token del link de WhatsApp (/admin/report?token=...) a la ubicación del reporte, para que el frontend
// lo lleve a su pantalla. Devuelve SOLO lo mínimo (nombre e ids), sin login: los datos del reporte se leen después con
// el mismo token por las rutas de solo lectura de campaign_manager (ver auth/report_token_auth.js). El token lleva
// dentro el id del reporte (ver utils/reportLink.js).
const resolveToken = async (req, res) => {
    const notFound = () => res.status(404).json({ message: 'Este link no es válido o ya no está disponible.' });
    try {
        const id = verifyReportToken(req.params.token);
        if (!id) return notFound();

        const report = await md.reportes.findByPk(id, {
            attributes: ['id', 'nombre'],
            include: [{
                model: md.campanas,
                as: 'campana',
                attributes: ['id'],
                include: [{ model: md.categorias, as: 'categoria', attributes: ['id', 'id_empresa'] }],
            }],
        });
        const campana = report?.campana;
        const categoria = campana?.categoria;
        if (!report || !campana || !categoria) return notFound();

        res.status(200).json({
            id: report.id,
            nombre: report.nombre,
            campana_id: campana.id,
            categoria_id: categoria.id,
            // id_empresa es BIGINT y el driver lo devuelve como texto: se normaliza a número como los otros ids.
            empresa_id: Number(categoria.id_empresa),
        });
    } catch (error) {
        res.status(500).json({ message: 'No se pudo cargar el reporte. Intente nuevamente en unos minutos.' });
    }
};

module.exports = { resolveToken };
