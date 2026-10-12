const ExcelJS = require('exceljs');

const NUM_FORMATS = {
    integer: '#,##0',
    money: '#,##0.00',
    percent: '0.0"%"',
    date: 'yyyy-mm-dd'
};

const COLUMN_WIDTHS = { text: 32, integer: 18, money: 18, percent: 14, date: 14 };

// Exportador genérico: arma el libro a partir de { title, columns, rows, summary }
// que devuelve cualquier reporte, así los reportes nuevos no necesitan código de Excel.
const buildWorkbook = async (title, { columns, rows, summary }) => {
    const workbook = new ExcelJS.Workbook();
    workbook.created = new Date();
    const sheet = workbook.addWorksheet(title.slice(0, 31));

    sheet.addRow([title]).font = { bold: true, size: 14 };
    sheet.addRow([`Generado: ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`]).font = { italic: true, color: { argb: 'FF666666' } };
    sheet.addRow([]);

    // Resumen (KPIs) arriba de la tabla
    (summary || []).forEach((s) => {
        const row = sheet.addRow([s.label, s.value]);
        row.getCell(1).font = { bold: true };
        if (NUM_FORMATS[s.type]) row.getCell(2).numFmt = NUM_FORMATS[s.type];
        row.getCell(2).alignment = { horizontal: 'left' };
    });
    if (summary?.length) sheet.addRow([]);

    const headerRow = sheet.addRow(columns.map((c) => c.title));
    const headerNumber = headerRow.number;
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.eachCell((cell) => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F3A5F' } };
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
    });

    rows.forEach((r) => {
        const row = sheet.addRow(columns.map((c) => r[c.key] ?? null));
        columns.forEach((c, i) => {
            if (NUM_FORMATS[c.type]) row.getCell(i + 1).numFmt = NUM_FORMATS[c.type];
        });
    });

    columns.forEach((c, i) => {
        sheet.getColumn(i + 1).width = Math.max(COLUMN_WIDTHS[c.type] || 18, i === 0 ? 32 : 0);
    });

    sheet.views = [{ state: 'frozen', ySplit: headerNumber }];
    sheet.autoFilter = {
        from: { row: headerNumber, column: 1 },
        to: { row: headerNumber, column: columns.length }
    };

    return workbook;
};

module.exports = { buildWorkbook };
