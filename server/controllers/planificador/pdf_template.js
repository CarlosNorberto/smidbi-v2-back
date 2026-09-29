'use strict';

// Documento del PDF de la propuesta del Planificador, armado con
// @react-pdf/renderer. Sin JSX a propósito: el backend no tiene transpilador
// configurado, así que se usa React.createElement plano (alias corto `h`).
const fs = require('fs');
const path = require('path');
const React = require('react');
const { Document, Page, View, Text, Image, StyleSheet } = require('@react-pdf/renderer');

const h = React.createElement;

const BRAND_COLOR = '#E60023';

// El <Image> de @react-pdf/renderer intenta resolver un string común vía fetch,
// así que una ruta local de archivo no sirve como `src` — se lee el archivo y se
// pasa como data URI.
const assetAsDataUri = (filename) => {
    const buffer = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', filename));
    return `data:image/png;base64,${buffer.toString('base64')}`;
};

// Mismo logo blanco que usa el panel lateral del login (auth_side_panel_component),
// pre-convertido a PNG porque @react-pdf/renderer no soporta SVG como <Image>.
const LOGO_WHITE_DATA_URI = assetAsDataUri('logo_smid_white.png');
// Insignia de certificación (Google Partner, versión blanca para el fondo rojo),
// subida directamente a server/assets.
const GOOGLE_PARTNER_DATA_URI = assetAsDataUri('google-partner-white.png');

const styles = StyleSheet.create({
    coverPage: {
        flexDirection: 'row',
        padding: 0,
    },
    coverSidebar: {
        width: '32%',
        backgroundColor: BRAND_COLOR,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 20,
    },
    coverLogo: {
        width: 130,
    },
    coverBadge: {
        width: 115,
        marginTop: 10,
    },
    coverBody: {
        width: '68%',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 40,
    },
    coverTitle: {
        fontSize: 26,
        fontWeight: 700,
        color: BRAND_COLOR,
        textAlign: 'center',
        marginBottom: 24,
    },
    coverLabel: {
        fontSize: 10,
        color: '#888888',
        textAlign: 'center',
        marginBottom: 2,
    },
    coverValue: {
        fontSize: 18,
        color: '#000000',
        textAlign: 'center',
        marginBottom: 20,
    },
    coverDate: {
        fontSize: 12,
        color: '#666666',
        textAlign: 'center',
    },
    page: {
        fontSize: 9,
    },
    pageHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: BRAND_COLOR,
        paddingHorizontal: 24,
        height: 46,
    },
    pageHeaderTitle: {
        fontSize: 14,
        color: '#FFFFFF',
        fontWeight: 700,
    },
    pageHeaderLogo: {
        width: 60,
    },
    pageBody: {
        padding: 24,
    },
    sectionSubtitle: {
        fontSize: 13,
        fontWeight: 700,
        color: '#333333',
        marginBottom: 8,
        marginTop: 18,
    },
    table: {
        display: 'table',
        width: 'auto',
        borderStyle: 'solid',
        borderColor: '#999999',
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    row: {
        flexDirection: 'row',
    },
    headerCell: {
        backgroundColor: BRAND_COLOR,
        color: '#FFFFFF',
        fontSize: 8,
        fontWeight: 700,
        padding: 4,
        borderStyle: 'solid',
        borderColor: '#999999',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        textAlign: 'center',
    },
    cell: {
        fontSize: 8,
        padding: 4,
        borderStyle: 'solid',
        borderColor: '#999999',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        textAlign: 'center',
    },
    cellLeft: {
        textAlign: 'left',
    },
    totalRow: {
        backgroundColor: '#EEEEEE',
        fontWeight: 700,
    },
    audienceSubtitle: {
        fontSize: 10,
        color: '#666666',
        marginBottom: 16,
    },
    audienceSectionTitle: {
        fontSize: 11,
        fontWeight: 700,
        color: '#333333',
        marginBottom: 6,
        marginTop: 14,
    },
    audienceParagraph: {
        fontSize: 9,
        lineHeight: 1.5,
        color: '#333333',
    },
    audienceRow: {
        flexDirection: 'row',
        marginBottom: 6,
    },
    audienceRowLabel: {
        fontSize: 9,
        fontWeight: 700,
        color: '#555555',
        width: 90,
    },
    audienceRowValue: {
        fontSize: 9,
        color: '#333333',
        flex: 1,
    },
    cellActive: {
        backgroundColor: '#EEEEEE',
        fontWeight: 700,
    },
    invTotalTitle: {
        fontSize: 20,
        fontWeight: 700,
        color: '#000000',
        textAlign: 'center',
        marginTop: 20,
        marginBottom: 24,
    },
    invTotalTableWrap: {
        alignItems: 'center',
    },
    invTotalTable: {
        width: 320,
        display: 'table',
        borderStyle: 'solid',
        borderColor: '#999999',
        borderWidth: 1,
        borderRightWidth: 0,
        borderBottomWidth: 0,
    },
    invTotalLabelCell: {
        width: '60%',
        fontSize: 11,
        fontWeight: 700,
        textAlign: 'left',
        padding: 6,
        borderStyle: 'solid',
        borderColor: '#999999',
        borderRightWidth: 1,
        borderBottomWidth: 1,
    },
    invTotalValueCell: {
        width: '40%',
        fontSize: 10,
        textAlign: 'right',
        padding: 6,
        borderStyle: 'solid',
        borderColor: '#999999',
        borderRightWidth: 1,
        borderBottomWidth: 1,
    },
    invTotalGrandRow: {
        backgroundColor: '#CCCCCC',
    },
    invTotalNote: {
        fontSize: 9,
        color: '#555555',
        textAlign: 'center',
        marginTop: 16,
    },
    lecturaTitle: {
        fontSize: 13,
        fontWeight: 700,
        color: '#000000',
        marginTop: 36,
        marginBottom: 8,
    },
    lecturaLine: {
        fontSize: 9,
        color: '#333333',
        marginBottom: 4,
    },
});

// Ancho relativo de cada columna (deben sumar 1 = 100%).
const COLUMNS = [
    { key: 'plataforma', label: 'Plataforma', width: 0.14 },
    { key: 'formato', label: 'Formato', width: 0.2 },
    { key: 'costo', label: 'Costo', width: 0.09 },
    { key: 'objetivo', label: 'Objetivo', width: 0.11 },
    { key: 'inversion', label: 'Inversión', width: 0.13 },
    { key: 'kpi_principal', label: 'KPI Principal', width: 0.13 },
    { key: 'kpi_secundario', label: 'KPI Secundario', width: 0.13 },
    { key: 'frecuencia', label: 'Frec.', width: 0.07 },
];

const formatNumber = (value) => {
    const num = Number(value) || 0;
    return num.toLocaleString('es-BO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const MESES_ABR = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];

// Encabezado repetido en todas las páginas de contenido (no en la portada, que
// tiene su propio diseño): barra roja con el título a la izquierda y el logo
// de SMID a la derecha.
const buildPageHeader = (title) => h(
    View,
    { style: styles.pageHeader },
    h(Text, { style: styles.pageHeaderTitle }, title),
    h(Image, { src: LOGO_WHITE_DATA_URI, style: styles.pageHeaderLogo }),
);

const buildCoverPage = (brief) => h(
    Page,
    { size: 'A4', orientation: 'landscape', style: styles.coverPage },
    h(
        View,
        { style: styles.coverSidebar },
        h(Image, { src: LOGO_WHITE_DATA_URI, style: styles.coverLogo }),
        h(Image, { src: GOOGLE_PARTNER_DATA_URI, style: styles.coverBadge }),
    ),
    h(
        View,
        { style: styles.coverBody },
        h(Text, { style: styles.coverTitle }, 'Plan de Medios / Media Plan'),
        h(Text, { style: styles.coverLabel }, 'Empresa'),
        h(Text, { style: styles.coverValue }, brief.nombre_empresa || '—'),
        h(Text, { style: styles.coverLabel }, 'Campaña'),
        h(Text, { style: styles.coverValue }, brief.nombre_campana || '—'),
        h(Text, { style: styles.coverDate }, new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })),
    ),
);

const joinList = (items) => (Array.isArray(items) && items.length > 0 ? items.join(', ') : '—');

// Fila "Label: Valor" de la sección Audiencia. Se omite directamente si no hay
// valor (en vez de mostrar todas las filas con "—", que ensucia la página
// cuando el brief tiene poca segmentación cargada).
const buildAudienceRow = (label, value) => {
    if (!value || value === '—') return null;
    return h(
        View,
        { style: styles.audienceRow, key: label },
        h(Text, { style: styles.audienceRowLabel }, label),
        h(Text, { style: styles.audienceRowValue }, value),
    );
};

const buildEstrategiaAudienciaPage = (brief) => {
    const audienceRows = [
        buildAudienceRow('Landing page', brief.url_destino),
        buildAudienceRow('Geolocalización', brief.geolocalizacion),
        buildAudienceRow('Ciudades', joinList(brief.geolocalizacion_ciudad)),
        buildAudienceRow('Edad', joinList(brief.segmentacion_edad)),
        buildAudienceRow('Sexo', joinList(brief.segmentacion_sexo)),
        buildAudienceRow('Intereses', joinList(brief.intereses)),
    ].filter(Boolean);

    return h(
        Page,
        { size: 'A4', orientation: 'landscape', style: styles.page },
        buildPageHeader('Estrategia y Audiencia / Strategy and Audience'),
        h(
            View,
            { style: styles.pageBody },
            h(Text, { style: styles.audienceSubtitle }, brief.nombre_campana || ''),
            h(Text, { style: styles.audienceSectionTitle }, 'Descripción de la Estrategia / Strategy Description'),
            h(Text, { style: styles.audienceParagraph }, brief.estrategia || 'No se especificó una estrategia para este brief.'),
            h(Text, { style: styles.audienceSectionTitle }, 'Audiencia / Audience'),
            audienceRows.length > 0
                ? h(View, null, ...audienceRows)
                : h(Text, { style: styles.audienceParagraph }, 'No hay datos de audiencia cargados para este brief.'),
        ),
    );
};

const buildCostosTable = (brief, lineas, objetivosById) => {
    const moneda = brief.moneda || '';
    let totalObjetivo = 0;
    let totalInversion = 0;
    let lastPlataforma = null;

    const bodyRows = lineas.map((linea) => {
        const plataformaNombre = linea.plataforma ? linea.plataforma.plataforma : '';
        const showPlataforma = plataformaNombre !== lastPlataforma;
        lastPlataforma = plataformaNombre;

        totalObjetivo += Number(linea.objetivo) || 0;
        totalInversion += Number(linea.inversion) || 0;

        const values = {
            plataforma: showPlataforma ? plataformaNombre : '',
            formato: linea.nombre,
            costo: formatNumber(linea.costo),
            objetivo: formatNumber(linea.objetivo),
            inversion: `${moneda} ${formatNumber(linea.inversion)}`,
            kpi_principal: objetivosById.get(linea.kpi_principal) || '—',
            kpi_secundario: objetivosById.get(linea.kpi_secundario) || '—',
            frecuencia: linea.frecuencia,
        };

        return h(
            View,
            { style: styles.row, key: linea.id },
            COLUMNS.map((col) => h(
                Text,
                {
                    key: col.key,
                    style: [styles.cell, { width: `${col.width * 100}%` }, col.key === 'formato' ? styles.cellLeft : null],
                },
                String(values[col.key] ?? ''),
            )),
        );
    });

    const totalRow = h(
        View,
        { style: [styles.row, styles.totalRow], key: 'total' },
        h(Text, { style: [styles.cell, { width: `${(COLUMNS[0].width + COLUMNS[1].width) * 100}%` }] }, 'TOTAL'),
        h(Text, { style: [styles.cell, { width: `${COLUMNS[2].width * 100}%` }] }, ''),
        h(Text, { style: [styles.cell, { width: `${COLUMNS[3].width * 100}%` }] }, formatNumber(totalObjetivo)),
        h(Text, { style: [styles.cell, { width: `${COLUMNS[4].width * 100}%` }] }, `${moneda} ${formatNumber(totalInversion)}`),
        h(Text, { style: [styles.cell, { width: `${(COLUMNS[5].width + COLUMNS[6].width + COLUMNS[7].width) * 100}%` }] }, ''),
    );

    return h(
        View,
        { style: styles.table },
        h(
            View,
            { style: styles.row },
            COLUMNS.map((col) => h(Text, { key: col.key, style: [styles.headerCell, { width: `${col.width * 100}%` }] }, col.label)),
        ),
        ...bodyRows,
        totalRow,
    );
};

// Distribución mensual/semanal de cada línea (% de la inversión por semana,
// ver `summary_meses` en performance_branding.js). Las columnas de semanas se
// arman con la unión de meses presentes entre todas las líneas del tipo —
// no asume que todas comparten exactamente el mismo rango de meses. No
// maneja campañas que cruzan fin de año (mismo límite que tenía la app
// antigua: ordena por número de mes 1-12, no por fecha real). Devuelve null
// si no hay ninguna distribución cargada (la sección directamente se omite).
const buildCronogramaTable = (lineas, summaryByCosto) => {
    const mesesSet = new Set();
    lineas.forEach((linea) => {
        (summaryByCosto.get(linea.id_costo) || []).forEach((m) => mesesSet.add(m.mes));
    });
    const meses = [...mesesSet].sort((a, b) => a - b);
    if (meses.length === 0) return null;

    const weekColumns = [];
    meses.forEach((mes) => {
        for (let semanaIndex = 0; semanaIndex < 4; semanaIndex++) {
            weekColumns.push({
                key: `${mes}_${semanaIndex}`,
                label: `${MESES_ABR[mes - 1]} s${semanaIndex + 1}`,
                mes,
                semanaIndex,
            });
        }
    });

    const plataformaWidth = 0.12;
    const formatoWidth = 0.16;
    const dynColWidth = (1 - plataformaWidth - formatoWidth) / (weekColumns.length + 1);

    let lastPlataforma = null;
    const bodyRows = lineas.map((linea) => {
        const plataformaNombre = linea.plataforma ? linea.plataforma.plataforma : '';
        const showPlataforma = plataformaNombre !== lastPlataforma;
        lastPlataforma = plataformaNombre;

        const porMes = new Map((summaryByCosto.get(linea.id_costo) || []).map((m) => [m.mes, m.semanas]));
        let totalLinea = 0;
        const weekCells = weekColumns.map((col) => {
            const semanas = porMes.get(col.mes);
            const valor = semanas && semanas[col.semanaIndex] ? Number(semanas[col.semanaIndex].valor) || 0 : 0;
            totalLinea += valor;
            return h(
                Text,
                { key: col.key, style: [styles.cell, { width: `${dynColWidth * 100}%` }, valor > 0 ? styles.cellActive : null] },
                valor > 0 ? `${valor}%` : '',
            );
        });

        return h(
            View,
            { style: styles.row, key: linea.id },
            h(Text, { style: [styles.cell, { width: `${plataformaWidth * 100}%` }] }, showPlataforma ? plataformaNombre : ''),
            h(Text, { style: [styles.cell, styles.cellLeft, { width: `${formatoWidth * 100}%` }] }, linea.nombre),
            weekCells,
            h(Text, { style: [styles.cell, styles.cellActive, { width: `${dynColWidth * 100}%` }] }, `${Math.round(totalLinea)}%`),
        );
    });

    return h(
        View,
        { style: styles.table },
        h(
            View,
            { style: styles.row },
            h(Text, { style: [styles.headerCell, { width: `${plataformaWidth * 100}%` }] }, 'Plataforma'),
            h(Text, { style: [styles.headerCell, { width: `${formatoWidth * 100}%` }] }, 'Formato'),
            weekColumns.map((col) => h(Text, { key: col.key, style: [styles.headerCell, { width: `${dynColWidth * 100}%` }] }, col.label)),
            h(Text, { style: [styles.headerCell, { width: `${dynColWidth * 100}%` }] }, 'Total'),
        ),
        bodyRows,
    );
};

// Costos y Cronograma del mismo tipo comparten una sola página (en vez de una
// página aparte cada uno) para aprovechar mejor el espacio — el Cronograma se
// omite si no hay ninguna distribución cargada para ese tipo.
const buildCostosYCronogramaPage = (brief, tipo, lineas, summaryByCosto, objetivosById) => {
    const tipoLabel = tipo === 'CPM' ? 'Campaña Branding (CPM)' : 'Campaña Performance (CPC/CPV)';
    const cronogramaTable = buildCronogramaTable(lineas, summaryByCosto);

    return h(
        Page,
        { size: 'A4', orientation: 'landscape', style: styles.page, key: tipo },
        buildPageHeader(`Costos y Cronograma / Costs and Schedule — ${tipoLabel}`),
        h(
            View,
            { style: styles.pageBody },
            h(Text, { style: [styles.sectionSubtitle, { marginTop: 0 }] }, 'Costos / Costs'),
            buildCostosTable(brief, lineas, objetivosById),
            cronogramaTable && h(Text, { style: styles.sectionSubtitle }, 'Cronograma / Gantt'),
            cronogramaTable,
        ),
    );
};

const sumInversion = (lineas) => lineas.reduce((acc, l) => acc + (Number(l.inversion) || 0), 0);

// Página final: resumen de inversión total facturada, sumando todos los tipos
// incluidos en el PDF (igual criterio que la app antigua — una fila por tipo
// presente más una fila "Monto Total Facturado" con la suma de todos).
const buildInversionTotalPage = (brief, secciones) => {
    const moneda = brief.moneda || '';
    const totalesPorTipo = secciones.map((s) => ({ tipo: s.tipo, total: sumInversion(s.lineas) }));
    const granTotal = totalesPorTipo.reduce((acc, t) => acc + t.total, 0);

    const rows = totalesPorTipo.map((t) => h(
        View,
        { style: styles.row, key: t.tipo },
        h(Text, { style: styles.invTotalLabelCell }, t.tipo === 'CPM' ? 'Campaña Branding' : 'Campaña Performance'),
        h(Text, { style: styles.invTotalValueCell }, `${moneda} ${formatNumber(t.total)}`),
    ));

    const tieneCpcCpv = secciones.some((s) => s.tipo === 'CPC_CPV');
    const tieneCpm = secciones.some((s) => s.tipo === 'CPM');
    const monedaLabel = moneda === '$us.' ? '$us. (Dólares Americanos)' : 'Bs. (Bolivianos)';

    const lecturaLineas = [
        `Todos los costos están expresados en ${monedaLabel} e incluyen todos los costos e impuestos de ley.`,
        'Este documento muestra la planificación de una campaña.',
        'El Gantt refleja el plazo y distribución de recursos de la campaña.',
        `La planificación propuesta trabaja bajo ${secciones.length > 1 ? 'los siguientes modelos:' : 'el siguiente modelo:'}`,
    ];
    if (tieneCpcCpv) {
        lecturaLineas.push(
            '- CPC = Costo x Clic / Interacción única por usuario en anuncio.',
            '- CPV = Costo por View / Visualizaciones de video.',
            '- CPE = Costo por Engagement o Interacción.',
            '- CPD = Costo por Descarga de una aplicación o software.',
        );
    }
    if (tieneCpm) {
        lecturaLineas.push('- CPM = Costo por mil impresiones del anuncio.');
    }

    return h(
        Page,
        { size: 'A4', orientation: 'landscape', style: styles.page },
        buildPageHeader('Inversión Total / Total Investment'),
        h(
            View,
            { style: styles.pageBody },
            h(Text, { style: styles.invTotalTitle }, 'Inversión Total / Total Investment'),
            h(
                View,
                { style: styles.invTotalTableWrap },
                h(
                    View,
                    { style: styles.invTotalTable },
                    h(
                        View,
                        { style: styles.row },
                        h(Text, { style: [styles.headerCell, { width: '60%' }] }, ''),
                        h(Text, { style: [styles.headerCell, { width: '40%' }] }, `Inversión ${moneda}`),
                    ),
                    rows,
                    h(
                        View,
                        { style: [styles.row, styles.invTotalGrandRow] },
                        h(Text, { style: [styles.invTotalLabelCell, styles.invTotalGrandRow] }, 'Monto Total Facturado'),
                        h(Text, { style: [styles.invTotalValueCell, styles.invTotalGrandRow] }, `${moneda} ${formatNumber(granTotal)}`),
                    ),
                ),
                h(Text, { style: styles.invTotalNote }, 'El monto total facturado incluye los costos por los servicios de SMID Media Center.'),
            ),
            h(Text, { style: styles.lecturaTitle }, 'LECTURA DE PROPUESTA / READ PLEASE'),
            lecturaLineas.map((linea, i) => h(Text, { key: i, style: styles.lecturaLine }, linea)),
        ),
    );
};

const buildPlanificadorPdf = ({ brief, secciones, objetivosById }) => h(
    Document,
    null,
    buildCoverPage(brief),
    buildEstrategiaAudienciaPage(brief),
    ...secciones.map((s) => buildCostosYCronogramaPage(brief, s.tipo, s.lineas, s.summaryByCosto || new Map(), objetivosById)),
    buildInversionTotalPage(brief, secciones),
);

module.exports = { buildPlanificadorPdf };
