const { listReports, getReport, resolveParams } = require('../reports');
const { buildWorkbook } = require('../reports/excelExporter');

const getCatalog = (req, res) => {
    res.status(200).json(listReports());
};

// Resuelve el reporte y sus parámetros; responde el error y devuelve null si algo no cuadra.
const loadReport = (req, res) => {
    const report = getReport(req.params.id);
    if (!report) {
        res.status(404).json({ message: 'No se encontró el reporte solicitado' });
        return null;
    }
    const { params, error } = resolveParams(report, req.query);
    if (error) {
        res.status(400).json({ message: error });
        return null;
    }
    return { report, params };
};

const run = async (req, res) => {
    try {
        const loaded = loadReport(req, res);
        if (!loaded) return;
        const { report, params } = loaded;

        const data = await report.build(params);
        res.status(200).json({
            id: report.id,
            title: report.title,
            description: report.description,
            generated_at: new Date().toISOString(),
            params,
            ...data
        });
    } catch (error) {
        res.status(500).json({ message: `Error al generar el reporte: ${error.message}` });
    }
};

const exportExcel = async (req, res) => {
    try {
        const loaded = loadReport(req, res);
        if (!loaded) return;
        const { report, params } = loaded;

        const data = await report.build(params);
        const workbook = await buildWorkbook(report.title, data);

        const fileName = `${report.id}_${new Date().toISOString().slice(0, 10)}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
        await workbook.xlsx.write(res);
        res.end();
    } catch (error) {
        if (res.headersSent) return res.end();
        res.status(500).json({ message: `Error al exportar el reporte: ${error.message}` });
    }
};

module.exports = { getCatalog, run, exportExcel };
