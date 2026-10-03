'use strict';

// Documento del PDF de la propuesta del Planificador, armado con
// @react-pdf/renderer. Sin JSX a propósito: el backend no tiene transpilador
// configurado, así que se usa React.createElement plano (alias corto `h`).
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const React = require('react');

const h = React.createElement;

// @react-pdf/renderer es un paquete ESM-only ("type": "module") — un `require`
// normal revienta en producción (Node 16, que no soporta requerir ESM desde
// CommonJS; localmente no se notaba porque Node 24 sí lo tolera). Se carga
// una sola vez con `import()` dinámico (soportado desde CJS en cualquier
// versión de Node razonablemente reciente) y se cachea la promesa — todo lo
// que sigue abajo son solo declaraciones de función, no corren hasta que se
// invoca `buildPlanificadorPdf`, que es quien espera esta carga primero.
let Document, Page, View, Text, Image, Svg, Path, Circle, Line, Rect, styles, renderToBuffer;
let reactPdfReady = null;
const FONTS_PATH = path.join(__dirname, '..', '..', 'assets', 'fonts');
const ensureReactPdf = () => {
    if (!reactPdfReady) {
        reactPdfReady = import('@react-pdf/renderer').then((mod) => {
            ({ Document, Page, View, Text, Image, Svg, Path, Circle, Line, Rect, renderToBuffer } = mod);
            // Tipografía redondeada (Poppins) para que el PDF coincida con el
            // estilo del resto del material de marketing — el PDF viejo usaba
            // Helvetica (la fuente estándar que ya trae cualquier lector, sin
            // registrar nada), pero no se parece en nada al diseño pedido.
            mod.Font.register({
                family: 'Poppins',
                fonts: [
                    { src: path.join(FONTS_PATH, 'Poppins-Regular.ttf'), fontWeight: 400 },
                    { src: path.join(FONTS_PATH, 'Poppins-Medium.ttf'), fontWeight: 500 },
                    { src: path.join(FONTS_PATH, 'Poppins-SemiBold.ttf'), fontWeight: 600 },
                    { src: path.join(FONTS_PATH, 'Poppins-Bold.ttf'), fontWeight: 700 },
                    { src: path.join(FONTS_PATH, 'Poppins-ExtraBold.ttf'), fontWeight: 800 },
                    { src: path.join(FONTS_PATH, 'Poppins-Black.ttf'), fontWeight: 900 },
                ],
            });
            styles = buildStyles(mod.StyleSheet);
        });
    }
    return reactPdfReady;
};

// A4 horizontal [841.89, 595.28] con la altura reducida 30% — se ve más
// parecido a un slide de deck (ancho, bajo) que a una hoja A4 de verdad,
// más cerca del diseño de referencia que el usuario compartió. Todas las
// páginas usan esta misma constante en vez de `size:'A4', orientation:
// 'landscape'`.
const PAGE_SIZE = [841.89, 416.7];

const BRAND_COLOR = '#E60023';
const COLORS = {
    bg: '#F0F1F3',
    card: '#FFFFFF',
    red: BRAND_COLOR,
    black: '#1A1A1A',
    gray: '#6B7280',
    grayLight: '#D1D5DB',
    border: '#E5E7EB',
};

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
// Misma marca pero en rojo (color de marca), para usar sobre fondos claros.
const LOGO_COLOR_DATA_URI = assetAsDataUri('logo_smid_color.png');
// Insignia de certificación (Google Partner) — versión blanca para fondo rojo,
// versión a color para fondo claro. Ambas subidas directamente a server/assets.
const GOOGLE_PARTNER_DATA_URI = assetAsDataUri('google-partner-white.png');
const GOOGLE_PARTNER_COLOR_DATA_URI = assetAsDataUri('google-partner.png');
// Insignias de certificación/premios para la portada, subidas directamente a
// server/assets. Falta un 5to logo (Best Brands B2B) — pendiente de subir.
const META_CERTIFIED_DATA_URI = assetAsDataUri('meta_certified.png');
const SELLO_BOLIVIA_DATA_URI = assetAsDataUri('sello_bolivia_2024.png');
// Mapa de Bolivia por departamentos (simplemaps.com, un <path> por
// departamento con id = código ISO 3166-2, fill transparente y stroke blanco
// por defecto) — en vez de un pin suelto, el departamento donde el brief
// segmenta se pinta de rojo directamente sobre el mapa. @react-pdf/renderer
// no soporta <Image> con SVG, así que se rasteriza a PNG con `sharp` al
// vuelo (el fill varía según qué departamentos tenga cada brief, no es un
// asset estático) y se embebe como data URI.
const BOLIVIA_SVG_RAW = fs.readFileSync(path.join(__dirname, '..', '..', 'assets', 'bo.svg'), 'utf8');
// Mismos nombres que guarda `geolocalizacion_ciudad` en el brief, mapeados al
// id de su departamento en el SVG.
const DEPARTAMENTO_SVG_ID = {
    'La Paz': 'BOL',
    Cochabamba: 'BOC',
    'Santa Cruz': 'BOS',
    Oruro: 'BOO',
    Potosí: 'BOP',
    Tarija: 'BOT',
    Sucre: 'BOH',
    Beni: 'BOB',
    Pando: 'BON',
};
const buildBoliviaMapDataUri = async (selectedIds) => {
    // Especificidad CSS: un selector de tipo solo (`path`) pierde contra un
    // selector de id (`#BOL`), así que el default va sin id y las
    // excepciones por departamento seleccionado ganan sin importar el orden.
    const style = `<style>path { fill: ${COLORS.grayLight}; stroke: #FFFFFF; stroke-width: 1.5; } `
        + `${selectedIds.map((id) => `#${id} { fill: ${COLORS.red}; }`).join(' ')}</style>`;
    const svg = BOLIVIA_SVG_RAW.replace('<g id="features">', `${style}<g id="features">`);
    const buffer = await sharp(Buffer.from(svg), { density: 150 }).resize(640, 640).png().toBuffer();
    return `data:image/png;base64,${buffer.toString('base64')}`;
};

const buildStyles = (StyleSheet) => StyleSheet.create({
    coverPage: {
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        padding: 40,
        fontFamily: 'Poppins',
    },
    coverTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    coverKicker: {
        fontSize: 11,
        fontWeight: 700,
        color: COLORS.black,
    },
    coverBadgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    coverBadgeLogo: {
        width: 85,
    },
    coverBadgeSmall: {
        width: 52,
    },
    coverBadgeMedal: {
        width: 56,
    },
    // Centra el bloque de título verticalmente en el espacio que queda entre
    // la fila de arriba (kicker + badges) y la nota de abajo (fecha de
    // cierre) — flex:1 hace que ocupe todo ese espacio disponible y
    // justifyContent lo centra dentro de esa caja.
    coverCenterWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    coverTitle: {
        fontSize: 40,
        fontWeight: 800,
        color: COLORS.black,
        lineHeight: 1.15,
    },
    coverSubtitle: {
        fontSize: 16,
        fontWeight: 400,
        color: COLORS.gray,
        marginTop: 14,
    },
    coverFooterNote: {
        fontSize: 10,
        color: COLORS.gray,
    },
    // Página "Resumen Ejecutivo" (3 tarjetas KPI) — mismo fondo claro y
    // tipografía que la portada, para que ambas páginas se sientan parte del
    // mismo rediseño (el resto de páginas todavía usa el estilo viejo hasta
    // que se rediseñen una por una).
    kpiPage: {
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        padding: 40,
        fontFamily: 'Poppins',
    },
    kpiCenterWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    kpiCardsRow: {
        flexDirection: 'row',
        gap: 20,
    },
    kpiCard: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 24,
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    // Card 1 (Inversión Total): sin ícono, solo título grande + el monto.
    kpiCard1Title: {
        fontSize: 20,
        fontWeight: 700,
        color: COLORS.black,
        marginBottom: 12,
    },
    kpiCardValue: {
        fontSize: 30,
        fontWeight: 800,
        color: COLORS.red,
    },
    // Cards 2 y 3 (Objetivo Principal/Secundario): ícono gris sin círculo,
    // jerarquía título (18, normal) -> "Generación de X" (22, bold) -> texto
    // de cierre (18, normal, gris — mismo color/tamaño que iría el número
    // cuando el card lo muestra).
    kpiObjTitle: {
        fontSize: 16,
        fontWeight: 400,
        color: COLORS.gray,
        marginBottom: 6,
    },
    kpiObjKpiLine: {
        fontSize: 22,
        fontWeight: 700,
        color: COLORS.black,
        marginBottom: 10,
    },
    kpiObjCaption: {
        fontSize: 16,
        fontWeight: 400,
        color: COLORS.gray,
        lineHeight: 1.3,
    },
    kpiCardExtra: {
        fontSize: 9,
        color: COLORS.gray,
        marginTop: 6,
    },
    // Página "Perfil de Audiencia": mapa de Bolivia con pines + tarjeta de
    // demografía, mismo fondo/tipografía clara que el resto del rediseño.
    audienciaPage: {
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        padding: 40,
        fontFamily: 'Poppins',
    },
    audienciaTitle: {
        fontSize: 26,
        fontWeight: 800,
        color: COLORS.black,
        marginBottom: 14,
    },
    audienciaRow: {
        flexDirection: 'row',
        gap: 24,
        flex: 1,
    },
    audienciaMapCol: {
        width: 230,
    },
    audienciaMapWrap: {
        width: 230,
        height: 230,
        position: 'relative',
    },
    audienciaMapImage: {
        width: 230,
        height: 230,
    },
    audienciaCard: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 16,
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    audienciaCardTitle: {
        fontSize: 16,
        fontWeight: 700,
        color: COLORS.black,
        marginBottom: 10,
    },
    audienciaGenderRow: {
        flexDirection: 'row',
        gap: 24,
        marginBottom: 10,
    },
    audienciaGenderItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    audienciaGenderLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: COLORS.black,
    },
    audienciaSubLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: COLORS.gray,
        marginBottom: 6,
    },
    audienciaPillsRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 10,
    },
    audienciaPill: {
        backgroundColor: COLORS.bg,
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 5,
    },
    audienciaPillText: {
        fontSize: 9,
        color: COLORS.black,
    },
    audienciaInterestPill: {
        backgroundColor: COLORS.red,
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 6,
        alignSelf: 'flex-start',
        marginBottom: 6,
    },
    audienciaInterestPillText: {
        fontSize: 11,
        color: '#FFFFFF',
        fontWeight: 700,
    },
    // Página "Mecánica de Inversión": un embudo de 4 tarjetas por línea de
    // cotización (se repite una vez por línea, no se agrega todo en un único
    // embudo — ver decisión registrada en la sesión: líneas con plataformas o
    // modelos distintos no se pueden resumir en un solo embudo sin perder
    // info). Mismo fondo/tipografía clara que el resto del rediseño.
    mecanicaPage: {
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        padding: 40,
        fontFamily: 'Poppins',
    },
    mecanicaTitle: {
        fontSize: 26,
        fontWeight: 800,
        color: COLORS.black,
        marginBottom: 22,
        lineHeight: 1.2,
    },
    mecanicaCenterWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    mecanicaFunnelBlock: {
        marginBottom: 20,
    },
    mecanicaFunnelRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    mecanicaCard: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 14,
        padding: 14,
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: COLORS.border,
        alignItems: 'center',
        justifyContent: 'center',
    },
    mecanicaBigValue: {
        fontSize: 22,
        fontWeight: 700,
        color: COLORS.red,
        textAlign: 'center',
    },
    mecanicaCaption: {
        fontSize: 12,
        color: COLORS.gray,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 1.3,
    },
    mecanicaPlatformLabel: {
        fontSize: 16,
        fontWeight: 700,
        color: COLORS.black,
        textAlign: 'center',
    },
    mecanicaPlatformName: {
        fontSize: 16,
        fontWeight: 700,
        color: COLORS.black,
        textAlign: 'center',
        marginTop: 2,
        marginBottom: 10,
    },
    mecanicaBulletsWrap: {
        alignItems: 'flex-start',
        alignSelf: 'stretch',
        paddingHorizontal: 6,
    },
    mecanicaBulletText: {
        fontSize: 9,
        color: COLORS.black,
        textAlign: 'left',
        marginTop: 3,
    },
    mecanicaKpiLabel: {
        fontSize: 20,
        fontWeight: 700,
        color: COLORS.black,
        textAlign: 'center',
        marginTop: 2,
    },
    mecanicaArrowWrap: {
        width: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    // Página "Cronograma de Ejecución": barra de semanas (llena si esa semana
    // concentra inversión, en blanco si no) + leyenda destacando la semana de
    // mayor concentración. Mismo fondo/tipografía clara del resto del
    // rediseño.
    cronogramaPage: {
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        padding: 40,
        fontFamily: 'Poppins',
    },
    cronogramaTitle: {
        fontSize: 26,
        fontWeight: 800,
        color: COLORS.black,
        marginBottom: 6,
    },
    cronogramaSubtitleBig: {
        fontSize: 26,
        fontWeight: 800,
        color: COLORS.black,
        marginBottom: 14,
    },
    cronogramaCenterWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    cronogramaBarRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 4,
    },
    cronogramaSegmentWrap: {
        flex: 1,
        alignItems: 'center',
    },
    cronogramaSegmentActive: {
        width: '100%',
        height: 44,
        borderRadius: 10,
        backgroundColor: COLORS.red,
        alignItems: 'center',
        justifyContent: 'center',
    },
    cronogramaSegmentEmpty: {
        width: '100%',
        height: 44,
        borderRadius: 10,
        backgroundColor: COLORS.card,
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cronogramaWeekLabel: {
        fontSize: 11,
        fontWeight: 600,
        color: COLORS.black,
        marginBottom: 5,
        textAlign: 'center',
    },
    cronogramaCallout: {
        alignItems: 'center',
        alignSelf: 'center',
        backgroundColor: COLORS.card,
        borderRadius: 14,
        paddingVertical: 10,
        paddingHorizontal: 28,
        marginTop: 18,
        maxWidth: 420,
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    cronogramaCalloutTitle: {
        fontSize: 15,
        fontWeight: 700,
        color: COLORS.black,
        marginBottom: 5,
        textAlign: 'center',
    },
    cronogramaCalloutText: {
        fontSize: 11,
        color: COLORS.black,
        textAlign: 'center',
        lineHeight: 1.4,
    },
    page: {
        fontSize: 9,
        fontFamily: 'Poppins',
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
    cellActive: {
        backgroundColor: '#EEEEEE',
        fontWeight: 700,
    },
    // Página "Glosario de Objetivos": grid 2x2 con los 4 modelos de costo,
    // resaltando cuáles están realmente en uso en este PDF.
    glosarioPage: {
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        padding: 40,
        fontFamily: 'Poppins',
    },
    glosarioTitle: {
        fontSize: 26,
        fontWeight: 800,
        color: COLORS.black,
        marginBottom: 12,
    },
    glosarioCenterWrap: {
        flex: 1,
        justifyContent: 'center',
    },
    glosarioRow: {
        flexDirection: 'row',
        gap: 20,
        marginBottom: 10,
    },
    glosarioCard: {
        flex: 1,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 14,
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    glosarioCardSelected: {
        borderColor: COLORS.red,
        borderWidth: 2,
    },
    glosarioBadge: {
        alignSelf: 'flex-start',
        backgroundColor: COLORS.red,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginBottom: 6,
    },
    glosarioBadgeText: {
        fontSize: 8,
        fontWeight: 700,
        color: '#FFFFFF',
    },
    glosarioCode: {
        fontSize: 20,
        fontWeight: 800,
        color: COLORS.black,
    },
    glosarioNombre: {
        fontSize: 13,
        fontWeight: 700,
        color: COLORS.black,
        marginTop: 3,
        marginBottom: 4,
    },
    glosarioDesc: {
        fontSize: 10,
        color: COLORS.gray,
        lineHeight: 1.3,
    },
    // Página final "Total Facturado": candado + tarjeta con el desglose por
    // tipo y el gran total, reemplazando la vieja tabla roja.
    totalFacturadoPage: {
        flexDirection: 'column',
        backgroundColor: COLORS.bg,
        padding: 40,
        fontFamily: 'Poppins',
    },
    totalFacturadoTitle: {
        fontSize: 26,
        fontWeight: 800,
        color: COLORS.black,
    },
    totalFacturadoCenterWrap: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    totalFacturadoLockWrap: {
        marginBottom: 20,
    },
    totalFacturadoCard: {
        width: 380,
        backgroundColor: COLORS.card,
        borderRadius: 16,
        padding: 24,
        borderStyle: 'solid',
        borderWidth: 1,
        borderColor: COLORS.border,
    },
    totalFacturadoRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 10,
    },
    totalFacturadoRowLabel: {
        fontSize: 12,
        color: COLORS.black,
    },
    totalFacturadoRowValue: {
        fontSize: 12,
        fontWeight: 600,
        color: COLORS.black,
    },
    totalFacturadoGrandRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 8,
        paddingTop: 14,
        borderTopWidth: 1,
        borderTopColor: COLORS.border,
        borderStyle: 'solid',
    },
    totalFacturadoGrandLabel: {
        fontSize: 14,
        fontWeight: 700,
        color: COLORS.black,
    },
    totalFacturadoGrandValue: {
        fontSize: 20,
        fontWeight: 800,
        color: COLORS.red,
    },
    totalFacturadoNote: {
        fontSize: 10,
        color: COLORS.gray,
        textAlign: 'center',
        marginTop: 20,
        maxWidth: 360,
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
    { size: PAGE_SIZE, style: styles.coverPage },
    h(
        View,
        { style: styles.coverTopRow },
        h(Text, { style: styles.coverKicker }, `${brief.nombre_empresa || ''} / Dashboard de Campaña`),
        h(
            View,
            { style: styles.coverBadgesRow },
            h(Image, { src: LOGO_COLOR_DATA_URI, style: styles.coverBadgeLogo }),
            h(Image, { src: GOOGLE_PARTNER_COLOR_DATA_URI, style: styles.coverBadgeSmall }),
            h(Image, { src: META_CERTIFIED_DATA_URI, style: styles.coverBadgeSmall }),
            h(Image, { src: SELLO_BOLIVIA_DATA_URI, style: styles.coverBadgeMedal }),
        ),
    ),
    h(
        View,
        { style: styles.coverCenterWrap },
        h(Text, { style: styles.coverTitle }, 'Plan de Medios Online:'),
        h(Text, { style: styles.coverTitle }, brief.nombre_campana || ''),
        h(Text, { style: styles.coverSubtitle }, 'Resumen Ejecutivo y Mecánica de Inversión'),
    ),
    h(
        Text,
        { style: styles.coverFooterNote },
        brief.fecha_fin
            ? `Cierre proyectado: ${new Date(brief.fecha_fin).toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })}`
            : `Fecha: ${new Date().toLocaleDateString('es-BO', { day: '2-digit', month: 'long', year: 'numeric' })}`,
    ),
);

// Ícono simple (SVG) por género — mismo tratamiento gris sin fondo que los
// íconos del Resumen Ejecutivo. Función (no un objeto fijo) por la misma
// razón que buildKpiIcons: Svg/Circle/Line solo existen después de que
// `ensureReactPdf` resuelve.
const buildGenderIcons = () => ({
    Hombres: h(
        Svg,
        { viewBox: '0 0 24 24', width: 22, height: 22 },
        h(Circle, { cx: 9, cy: 15, r: 6, stroke: COLORS.gray, strokeWidth: 2, fill: 'none' }),
        h(Line, { x1: 13.5, y1: 10.5, x2: 20, y2: 4, stroke: COLORS.gray, strokeWidth: 2 }),
        h(Line, { x1: 14, y1: 4, x2: 20, y2: 4, stroke: COLORS.gray, strokeWidth: 2 }),
        h(Line, { x1: 20, y1: 4, x2: 20, y2: 10, stroke: COLORS.gray, strokeWidth: 2 }),
    ),
    Mujeres: h(
        Svg,
        { viewBox: '0 0 24 24', width: 22, height: 22 },
        h(Circle, { cx: 12, cy: 8, r: 6, stroke: COLORS.gray, strokeWidth: 2, fill: 'none' }),
        h(Line, { x1: 12, y1: 14, x2: 12, y2: 22, stroke: COLORS.gray, strokeWidth: 2 }),
        h(Line, { x1: 8, y1: 18, x2: 16, y2: 18, stroke: COLORS.gray, strokeWidth: 2 }),
    ),
});

// Mapa de Bolivia con pines por ciudad (solo las que tengan coordenadas
// conocidas en CITY_COORDS) + tarjeta de demografía (sexo, edad, intereses).
// Reemplaza la vieja sección "Audiencia" de lista plana. `boliviaMapDataUri`
// viene precalculado (ver renderPlanificadorPdf) porque rasterizar el SVG con
// `sharp` es async y buildDocument/buildAudienciaPage son síncronas.
const buildAudienciaPage = (brief, boliviaMapDataUri) => {
    const sexos = Array.isArray(brief.segmentacion_sexo) ? brief.segmentacion_sexo : [];
    const edades = Array.isArray(brief.segmentacion_edad) ? brief.segmentacion_edad : [];
    const intereses = Array.isArray(brief.intereses) ? brief.intereses : [];
    const [interesPrincipal, ...otrosIntereses] = intereses;
    const genderIcons = buildGenderIcons();

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.audienciaPage },
        h(Text, { style: styles.audienciaTitle }, 'Perfil de Audiencia: ¿A quién impactaremos?'),
        h(
            View,
            { style: styles.audienciaRow },
            h(
                View,
                { style: styles.audienciaMapCol },
                h(
                    View,
                    { style: styles.audienciaMapWrap },
                    h(Image, { src: boliviaMapDataUri, style: styles.audienciaMapImage }),
                ),
            ),
            h(
                View,
                { style: styles.audienciaCard },
                h(Text, { style: styles.audienciaCardTitle }, 'Hombres y Mujeres'),
                sexos.length > 0
                    ? h(
                        View,
                        { style: styles.audienciaGenderRow },
                        sexos.map((sexo) => h(
                            View,
                            { key: sexo, style: styles.audienciaGenderItem },
                            genderIcons[sexo] || null,
                            h(Text, { style: styles.audienciaGenderLabel }, sexo),
                        )),
                    )
                    : null,
                edades.length > 0
                    ? h(
                        View,
                        null,
                        h(Text, { style: styles.audienciaSubLabel }, 'Rangos de edad'),
                        h(
                            View,
                            { style: styles.audienciaPillsRow },
                            edades.map((edad) => h(
                                View,
                                { key: edad, style: styles.audienciaPill },
                                h(Text, { style: styles.audienciaPillText }, edad),
                            )),
                        ),
                    )
                    : null,
                interesPrincipal
                    ? h(
                        View,
                        null,
                        h(Text, { style: styles.audienciaSubLabel }, 'Interés principal'),
                        h(
                            View,
                            { style: styles.audienciaInterestPill },
                            h(Text, { style: styles.audienciaInterestPillText }, interesPrincipal),
                        ),
                    )
                    : null,
                otrosIntereses.length > 0
                    ? h(
                        View,
                        null,
                        h(Text, { style: styles.audienciaSubLabel }, 'Otros intereses'),
                        h(
                            View,
                            { style: styles.audienciaPillsRow },
                            otrosIntereses.map((interes) => h(
                                View,
                                { key: interes, style: styles.audienciaPill },
                                h(Text, { style: styles.audienciaPillText }, interes),
                            )),
                        ),
                    )
                    : null,
            ),
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

const MESES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Meses con distribución semanal cargada (de cualquier línea del tipo),
// ordenados — null si ninguna línea tiene `summary_meses`, para que la
// página se omita en ese caso. Mismo límite que el resto del documento: no
// maneja campañas que cruzan fin de año (ordena por número de mes 1-12).
const getCronogramaMeses = (lineas, summaryByCosto) => {
    const mesesSet = new Set();
    lineas.forEach((linea) => {
        (summaryByCosto.get(linea.id_costo) || []).forEach((m) => mesesSet.add(m.mes));
    });
    const meses = [...mesesSet].sort((a, b) => a - b);
    return meses.length > 0 ? meses : null;
};

// Página "Cronograma de Ejecución": una barra con una celda por semana del
// sprint. Patrón de diseño fijo (confirmado con el usuario): siempre se
// pinta de rojo la Semana 1 y el callout siempre describe la primera
// semana — no recalcula cuál semana concentra más gasto real.
const buildCronogramaEjecucionPage = (brief, tipo, lineas, summaryByCosto) => {
    const meses = getCronogramaMeses(lineas, summaryByCosto);
    if (!meses) return null;

    const totalSemanas = meses.length * 4;
    const semanas = Array.from({ length: totalSemanas }, (_, i) => ({ key: i, label: `Semana ${i + 1}` }));
    const sprintMes = MESES_FULL[meses[0] - 1];

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.cronogramaPage, key: `cronograma-${tipo}` },
        h(Text, { style: styles.cronogramaTitle }, 'Cronograma de Ejecución'),
        h(Text, { style: styles.cronogramaSubtitleBig }, `Sprint de ${sprintMes}`),
        h(
            View,
            { style: styles.cronogramaCenterWrap },
            h(
                View,
                { style: styles.cronogramaBarRow },
                semanas.map((s) => h(
                    View,
                    { key: s.key, style: styles.cronogramaSegmentWrap },
                    h(Text, { style: styles.cronogramaWeekLabel }, s.label),
                    s.key === 0
                        ? h(View, { style: styles.cronogramaSegmentActive })
                        : h(View, { style: styles.cronogramaSegmentEmpty }),
                )),
            ),
            h(
                View,
                { style: styles.cronogramaCallout },
                h(Text, { style: styles.cronogramaCalloutTitle }, 'Concentración de Impacto'),
                h(
                    Text,
                    { style: styles.cronogramaCalloutText },
                    '100% de la inversión y esfuerzo publicitario ejecutado en Facebook CPC durante la primera semana.',
                ),
            ),
        ),
    );
};

// Flecha roja (cuerpo + punta) entre tarjetas del embudo — dibujada con los
// primitivos SVG, mismo criterio que los íconos del Resumen Ejecutivo (no
// hace falta un asset nuevo para esto).
const buildFunnelArrow = () => h(
    View,
    { style: styles.mecanicaArrowWrap },
    h(
        Svg,
        { viewBox: '0 0 24 24', width: 22, height: 22 },
        h(Rect, { x: 2, y: 10, width: 13, height: 4, fill: COLORS.red }),
        h(Path, { d: 'M13 5 L22 12 L13 19 Z', fill: COLORS.red }),
    ),
);

// Card 1: solo el monto (grande, en rojo) y la leyenda fija debajo — sin
// título ni ícono.
const buildPresupuestoCard = (moneda, inversion) => h(
    View,
    { style: styles.mecanicaCard },
    h(Text, { style: styles.mecanicaBigValue }, `${moneda} ${formatNumber(inversion)}`),
    h(Text, { style: styles.mecanicaCaption }, 'Presupuesto asignado'),
);

// Card 2: "Plataforma" + nombre real, y viñetas con el modelo de costo, el
// costo proyectado y la frecuencia de esa línea. El modelo se muestra
// genérico por tipo de sección (CPC/CPV vs CPM) — el dato real no distingue
// CPC de CPV/CPE/CPD por línea, así que no se inventa.
const buildPlataformaCard = (linea, tipo, moneda) => {
    const modeloLabel = tipo === 'CPM' ? 'Modelo CPM (Costo por Mil Impresiones)' : 'Modelo CPC/CPV (Costo por Clic o View)';
    const unidad = tipo === 'CPM' ? 'por mil impresiones' : 'por clic/view';
    return h(
        View,
        { style: styles.mecanicaCard },
        h(Text, { style: styles.mecanicaPlatformLabel }, 'Plataforma'),
        h(Text, { style: styles.mecanicaPlatformName }, linea.plataforma ? linea.plataforma.plataforma : '—'),
        h(
            View,
            { style: styles.mecanicaBulletsWrap },
            h(Text, { style: styles.mecanicaBulletText }, `• ${modeloLabel}`),
            h(Text, { style: styles.mecanicaBulletText }, `• Costo proyectado: ${moneda} ${formatNumber(linea.costo)} ${unidad}`),
            h(Text, { style: styles.mecanicaBulletText }, `• Frecuencia: ${linea.frecuencia}`),
        ),
    );
};

// Card 3: el número alcanzado (rojo) + el nombre del KPI principal (negro,
// mismo tamaño que el nombre de plataforma de la card 2) + leyenda fija.
const buildObjetivoAlcanzadoCard = (objetivo, kpiPrincipal) => h(
    View,
    { style: styles.mecanicaCard },
    h(Text, { style: styles.mecanicaBigValue }, formatNumber(objetivo)),
    h(Text, { style: styles.mecanicaKpiLabel }, kpiPrincipal),
    h(Text, { style: styles.mecanicaCaption }, 'KPI Principal alcanzado'),
);

// Card 4: solo el nombre del KPI secundario (sin número — performance_branding
// no guarda una cifra separada para el KPI secundario) + leyenda fija de 2
// líneas.
const buildKpiSecundarioCard = (kpiSecundario) => h(
    View,
    { style: styles.mecanicaCard },
    h(Text, { style: styles.mecanicaKpiLabel }, kpiSecundario),
    h(Text, { style: styles.mecanicaCaption }, 'KPI Secundario\n(Conversiones)'),
);

// Embudo de 4 tarjetas (Presupuesto → Plataforma y Modelo → Objetivo
// Alcanzado → KPI Secundario) repetido una vez por línea de cotización —
// decisión ya confirmada con el usuario: no se resume en un solo embudo
// porque cada línea puede perseguir plataformas/KPIs distintos entre sí.
const buildFunnelRow = (linea, tipo, moneda, objetivosById) => {
    const kpiPrincipal = objetivosById.get(linea.kpi_principal) || 'Objetivo';
    const kpiSecundario = objetivosById.get(linea.kpi_secundario) || '—';

    return h(
        View,
        { key: linea.id, style: styles.mecanicaFunnelBlock, wrap: false },
        h(
            View,
            { style: styles.mecanicaFunnelRow },
            buildPresupuestoCard(moneda, linea.inversion),
            buildFunnelArrow(),
            buildPlataformaCard(linea, tipo, moneda),
            buildFunnelArrow(),
            buildObjetivoAlcanzadoCard(linea.objetivo, kpiPrincipal),
            buildFunnelArrow(),
            buildKpiSecundarioCard(kpiSecundario),
        ),
    );
};

const buildMecanicaInversionPage = (brief, tipo, lineas, objetivosById) => {
    const moneda = brief.moneda || '';

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.mecanicaPage, key: `mecanica-${tipo}` },
        h(Text, { style: styles.mecanicaTitle }, 'Mecánica de Inversión:\nEl Embudo de Rendimiento'),
        h(
            View,
            { style: styles.mecanicaCenterWrap },
            ...lineas.map((linea) => buildFunnelRow(linea, tipo, moneda, objetivosById)),
        ),
    );
};

// Página de Costos — el Cronograma ahora vive en su propia página
// (buildCronogramaEjecucionPage, la barra de semanas) como parte del
// rediseño.
const buildCostosPage = (brief, tipo, lineas, objetivosById) => {
    const tipoLabel = tipo === 'CPM' ? 'Campaña Branding (CPM)' : 'Campaña Performance (CPC/CPV)';

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.page, key: `costos-${tipo}` },
        buildPageHeader(`Costos / Costs — ${tipoLabel}`),
        h(
            View,
            { style: styles.pageBody },
            h(Text, { style: [styles.sectionSubtitle, { marginTop: 0 }] }, 'Costos / Costs'),
            buildCostosTable(brief, lineas, objetivosById),
        ),
    );
};

const sumInversion = (lineas) => lineas.reduce((acc, l) => acc + (Number(l.inversion) || 0), 0);

// Los 4 modelos de costo que explica el Glosario. `tipos` son los valores
// reales de `performance_branding.tipo` que lo activan — CPC y CPV comparten
// el mismo tipo de sección (CPC_CPV) porque el dato real no distingue cuál
// de los dos aplica a cada línea (mismo criterio ya usado en la Mecánica de
// Inversión: no se inventa una distinción que no existe en la base).
const MODELOS_GLOSARIO = [
    { code: 'CPC', nombre: 'Costo por Clic', desc: 'Se paga por cada clic único de un usuario en el anuncio.', tipos: ['CPC_CPV'] },
    { code: 'CPV', nombre: 'Costo por View', desc: 'Se paga por cada visualización completa de un video.', tipos: ['CPC_CPV'] },
    { code: 'CPE', nombre: 'Costo por Engagement', desc: 'Se paga por cada interacción (like, comentario, compartir) con el anuncio.', tipos: [] },
    { code: 'CPM', nombre: 'Costo por Mil Impresiones', desc: 'Se paga por cada mil veces que se muestra el anuncio.', tipos: ['CPM'] },
];

// Página "Glosario de Objetivos": grid 2x2 con los 4 modelos de costo,
// marcando con una insignia cuáles están realmente en uso en este PDF según
// los tipos de sección incluidos.
const buildGlosarioPage = (secciones) => {
    const tiposPresentes = new Set(secciones.map((s) => s.tipo));
    const modelos = MODELOS_GLOSARIO.map((m) => ({ ...m, seleccionado: m.tipos.some((t) => tiposPresentes.has(t)) }));

    const buildCard = (m) => h(
        View,
        { key: m.code, style: [styles.glosarioCard, m.seleccionado && styles.glosarioCardSelected] },
        m.seleccionado
            ? h(View, { style: styles.glosarioBadge }, h(Text, { style: styles.glosarioBadgeText }, 'Modelo Seleccionado'))
            : null,
        h(Text, { style: styles.glosarioCode }, m.code),
        h(Text, { style: styles.glosarioNombre }, m.nombre),
        h(Text, { style: styles.glosarioDesc }, m.desc),
    );

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.glosarioPage },
        h(Text, { style: styles.glosarioTitle }, 'Glosario de Objetivos'),
        h(
            View,
            { style: styles.glosarioCenterWrap },
            h(View, { style: styles.glosarioRow }, buildCard(modelos[0]), buildCard(modelos[1])),
            h(View, { style: styles.glosarioRow }, buildCard(modelos[2]), buildCard(modelos[3])),
        ),
    );
};

// Ícono de candado (SVG) para la página final de Total Facturado.
const buildLockIcon = () => h(
    Svg,
    { viewBox: '0 0 24 24', width: 48, height: 48 },
    h(Path, { d: 'M8 11 V8 a4 4 0 0 1 8 0 v3', fill: 'none', stroke: COLORS.gray, strokeWidth: 2 }),
    h(Rect, { x: 5, y: 11, width: 14, height: 10, rx: 2, fill: COLORS.gray }),
    h(Circle, { cx: 12, cy: 16, r: 1.6, fill: COLORS.card }),
);

// Página final "Total Facturado": candado + tarjeta con el desglose por tipo
// y el gran total. El glosario de modelos (CPC/CPV/CPE/CPM) se mudó a su
// propia página — ya no repite esa explicación acá.
const buildTotalFacturadoPage = (brief, secciones) => {
    const moneda = brief.moneda || '';
    const totalesPorTipo = secciones.map((s) => ({ tipo: s.tipo, total: sumInversion(s.lineas) }));
    const granTotal = totalesPorTipo.reduce((acc, t) => acc + t.total, 0);

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.totalFacturadoPage },
        h(Text, { style: styles.totalFacturadoTitle }, 'Total Facturado'),
        h(
            View,
            { style: styles.totalFacturadoCenterWrap },
            h(View, { style: styles.totalFacturadoLockWrap }, buildLockIcon()),
            h(
                View,
                { style: styles.totalFacturadoCard },
                totalesPorTipo.map((t) => h(
                    View,
                    { key: t.tipo, style: styles.totalFacturadoRow },
                    h(Text, { style: styles.totalFacturadoRowLabel }, t.tipo === 'CPM' ? 'Campaña Branding' : 'Campaña Performance'),
                    h(Text, { style: styles.totalFacturadoRowValue }, `${moneda} ${formatNumber(t.total)}`),
                )),
                h(
                    View,
                    { style: styles.totalFacturadoGrandRow },
                    h(Text, { style: styles.totalFacturadoGrandLabel }, 'Monto Total Facturado'),
                    h(Text, { style: styles.totalFacturadoGrandValue }, `${moneda} ${formatNumber(granTotal)}`),
                ),
            ),
            h(
                Text,
                { style: styles.totalFacturadoNote },
                'El monto total facturado incluye los costos por los servicios de SMID Media Center.',
            ),
        ),
    );
};

const formatInt = (value) => Math.round(Number(value) || 0).toLocaleString('es-BO');

// Íconos simples dibujados con los primitivos SVG de @react-pdf/renderer (no
// hace falta subir imágenes nuevas para esto, a diferencia de los logos).
// Función (no un objeto fijo) porque Svg/Path/Circle/Rect solo quedan
// asignados después de que `ensureReactPdf` resuelve — construirlos como
// `const` al cargar el módulo los dejaría en `undefined` para siempre. Sin
// círculo de fondo: van directo en gris, un poco más grandes que el tamaño
// de ícono "de badge" que se usaba antes.
const buildKpiIcons = () => ({
    cursor: h(
        Svg,
        { viewBox: '0 0 24 24', width: 32, height: 32 },
        h(Path, { d: 'M4 2 L4 20 L9 16 L12 22 L15 20.5 L12 14.5 L19 14.5 Z', fill: COLORS.gray }),
    ),
    person: h(
        Svg,
        { viewBox: '0 0 24 24', width: 32, height: 32 },
        h(Circle, { cx: 12, cy: 7, r: 4, fill: COLORS.gray }),
        h(Path, { d: 'M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8', fill: 'none', stroke: COLORS.gray, strokeWidth: 2 }),
    ),
});

// Agrupa las líneas por el KPI (principal o secundario) que tengan asignado y
// suma el `objetivo` de cada grupo — una campaña puede combinar líneas que
// persiguen KPIs distintos (ej. unas en Clics, otras en Vistas), así que en
// vez de sumar todo en un solo número que mezclaría unidades distintas, se
// muestra el grupo más grande como cifra principal de la tarjeta y el resto
// como líneas chicas debajo ("+ N KPI").
const buildKpiGroups = (lineas, kpiField, objetivosById) => {
    const map = new Map();
    lineas.forEach((linea) => {
        const label = objetivosById.get(linea[kpiField]) || 'Objetivo';
        map.set(label, (map.get(label) || 0) + (Number(linea.objetivo) || 0));
    });
    return [...map.entries()]
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total);
};

// Tarjeta de objetivo (card 2 y 3): ícono gris, título normal, "Generación de
// {KPI}" (nombre real del KPI principal/secundario cargado en la línea de
// cotización) en negrita, y un texto de cierre — con el número incluido ahí
// mismo (mismo tamaño/color que el texto, sin negrita ni rojo) cuando
// corresponde mostrarlo. El card de Objetivo Secundario no lleva número,
// solo el texto fijo de cierre.
const buildObjetivoCard = ({ icon, cardLabel, kpiLabel, captionText, extra }) => h(
    View,
    { style: styles.kpiCard },
    icon,
    h(Text, { style: [styles.kpiObjTitle, { marginTop: 14 }] }, cardLabel),
    h(Text, { style: styles.kpiObjKpiLine }, `Generación de ${kpiLabel}`),
    h(Text, { style: styles.kpiObjCaption }, captionText),
    extra && extra.length > 0
        ? h(View, { style: { marginTop: 6 } }, extra.map((e, i) => h(
            Text,
            { key: i, style: styles.kpiCardExtra },
            `+ ${formatInt(e.total)} ${e.label}`,
        )))
        : null,
);

// Página "Resumen Ejecutivo": 3 tarjetas de alto nivel (inversión total,
// objetivo principal, objetivo secundario) agregando TODAS las líneas de
// TODOS los tipos incluidos en el PDF — a diferencia del embudo "Mecánica de
// Inversión" (pendiente, se repite por línea), esta es la vista panorámica.
// Sin header: la página son solo las 3 tarjetas centradas.
const buildKpiResumenPage = (brief, secciones, objetivosById) => {
    const moneda = brief.moneda || '';
    const allLineas = secciones.flatMap((s) => s.lineas);
    const granTotal = sumInversion(allLineas);
    const principalGroups = buildKpiGroups(allLineas, 'kpi_principal', objetivosById);
    const secundarioGroups = buildKpiGroups(allLineas, 'kpi_secundario', objetivosById);
    const icons = buildKpiIcons();
    const principal = principalGroups[0];
    const secundario = secundarioGroups[0];

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.kpiPage },
        h(
            View,
            { style: styles.kpiCenterWrap },
            h(
                View,
                { style: styles.kpiCardsRow },
                // Card 1: sin ícono — solo el título grande y el monto debajo.
                h(
                    View,
                    { style: styles.kpiCard },
                    h(Text, { style: styles.kpiCard1Title }, 'Inversión Total'),
                    h(Text, { style: styles.kpiCardValue }, `${moneda} ${formatNumber(granTotal)}`),
                ),
                buildObjetivoCard({
                    icon: icons.cursor,
                    cardLabel: 'Objetivo Principal',
                    kpiLabel: principal?.label || 'Objetivo',
                    captionText: principal
                        ? `${formatInt(principal.total)} interacciones únicas estimadas.`
                        : 'interacciones únicas estimadas.',
                    extra: principalGroups.slice(1),
                }),
                buildObjetivoCard({
                    icon: icons.person,
                    cardLabel: 'Objetivo Secundario',
                    kpiLabel: secundario?.label || 'Objetivo',
                    captionText: 'El tráfico generado alimentará la base de contactos.',
                }),
            ),
        ),
    );
};

const buildDocument = ({ brief, secciones, objetivosById, boliviaMapDataUri }) => h(
    Document,
    null,
    buildCoverPage(brief),
    buildKpiResumenPage(brief, secciones, objetivosById),
    buildAudienciaPage(brief, boliviaMapDataUri),
    ...secciones.map((s) => buildMecanicaInversionPage(brief, s.tipo, s.lineas, objetivosById)),
    ...secciones
        .map((s) => buildCronogramaEjecucionPage(brief, s.tipo, s.lineas, s.summaryByCosto || new Map()))
        .filter(Boolean),
    // La página de Costos (tabla CPC/CPV + CPM) se quitó del PDF a pedido del
    // usuario — buildCostosPage sigue definida y funcional más abajo, ver
    // CLAUDE.md ("Página de Costos del PDF del Planificador") para cómo
    // volver a incluirla.
    buildGlosarioPage(secciones),
    buildTotalFacturadoPage(brief, secciones),
);

// Único punto de entrada del módulo: arma el documento y lo renderiza a
// buffer. Async porque espera la carga de @react-pdf/renderer (ver
// ensureReactPdf arriba) antes de tocar cualquiera de los builders de más
// arriba, que asumen que Document/Page/View/Text/Image/styles ya existen —
// y porque el mapa de Bolivia se rasteriza con `sharp` (también async) antes
// de poder construir el documento, dado que su fill depende de los
// departamentos segmentados en este brief en particular.
const renderPlanificadorPdf = async (args) => {
    await ensureReactPdf();
    const ciudades = Array.isArray(args.brief.geolocalizacion_ciudad) ? args.brief.geolocalizacion_ciudad : [];
    const deptIds = [...new Set(ciudades.map((c) => DEPARTAMENTO_SVG_ID[c]).filter(Boolean))];
    const boliviaMapDataUri = await buildBoliviaMapDataUri(deptIds);
    return renderToBuffer(buildDocument({ ...args, boliviaMapDataUri }));
};

module.exports = { renderPlanificadorPdf };
