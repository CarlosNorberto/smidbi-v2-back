// Registro de reportes. Para agregar uno nuevo: crear su archivo
// `<nombre>.report.js` exportando `{ report }` con la forma
//   { id, title, description, params: [{ key, label, type, required }],
//     build: async (params) => ({ columns, rows, summary }) }
// y sumarlo a la lista de abajo. Las rutas y la exportación a Excel son
// genéricas, no hace falta tocarlas.
const reports = [
    require('./clientesActivos.report').report,
    require('./tiemposTareas.report').report
];

const byId = new Map(reports.map((r) => [r.id, r]));

const listReports = () => reports.map(({ id, title, description, params }) => ({ id, title, description, params }));

const getReport = (id) => byId.get(id) || null;

// Valida y normaliza los parámetros que llegan por query string según lo que
// declara el reporte. Devuelve { params } o { error }.
const resolveParams = (report, query = {}) => {
    const params = {};
    for (const def of report.params) {
        const value = query[def.key];
        if (value === undefined || value === '') {
            if (def.required) return { error: `El parámetro "${def.label || def.key}" es obligatorio` };
            continue;
        }
        if (def.type === 'date' && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
            return { error: `El parámetro "${def.label || def.key}" debe tener formato YYYY-MM-DD` };
        }
        if (def.type === 'month' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) {
            return { error: `El parámetro "${def.label || def.key}" debe tener formato AAAA-MM` };
        }
        params[def.key] = value;
    }
    return { params };
};

module.exports = { listReports, getReport, resolveParams };
