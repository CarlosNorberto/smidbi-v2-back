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
let Document,
    Page,
    View,
    Text,
    Image,
    Svg,
    Path,
    Circle,
    Line,
    Rect,
    styles,
    renderToBuffer;
let reactPdfReady = null;
const FONTS_PATH = path.join(__dirname, '..', '..', 'assets', 'fonts');
const ensureReactPdf = () => {
    if (!reactPdfReady) {
        reactPdfReady = import('@react-pdf/renderer').then((mod) => {
            ({
                Document,
                Page,
                View,
                Text,
                Image,
                Svg,
                Path,
                Circle,
                Line,
                Rect,
                renderToBuffer,
            } = mod);
            // Tipografía redondeada (Poppins) para que el PDF coincida con el
            // estilo del resto del material de marketing — el PDF viejo usaba
            // Helvetica (la fuente estándar que ya trae cualquier lector, sin
            // registrar nada), pero no se parece en nada al diseño pedido.
            mod.Font.register({
                family: 'Poppins',
                fonts: [
                    {
                        src: path.join(FONTS_PATH, 'Poppins-Regular.ttf'),
                        fontWeight: 400,
                    },
                    {
                        src: path.join(FONTS_PATH, 'Poppins-Medium.ttf'),
                        fontWeight: 500,
                    },
                    {
                        src: path.join(FONTS_PATH, 'Poppins-SemiBold.ttf'),
                        fontWeight: 600,
                    },
                    {
                        src: path.join(FONTS_PATH, 'Poppins-Bold.ttf'),
                        fontWeight: 700,
                    },
                    {
                        src: path.join(FONTS_PATH, 'Poppins-ExtraBold.ttf'),
                        fontWeight: 800,
                    },
                    {
                        src: path.join(FONTS_PATH, 'Poppins-Black.ttf'),
                        fontWeight: 900,
                    },
                ],
            });
            styles = buildStyles(mod.StyleSheet);
        });
    }
    return reactPdfReady;
};

// Mismo ancho que A4 horizontal (841.89pt) pero con el alto del aspect ratio
// 16:9 de un slide de verdad (841.89 * 9/16) en vez de los 595.28pt de una
// hoja A4 — es el mismo motivo por el que se achicó originalmente (verse
// como un deck, no como una hoja impresa), con un poco más de aire que el
// primer recorte (30%) porque algunas tarjetas quedaban justas de espacio.
// Todas las páginas usan esta misma constante en vez de `size:'A4',
// orientation:'landscape'`.
const PAGE_SIZE = [841.89, 473.56];

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
const ASSET_MIME_TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg' };
const assetAsDataUri = (filename) => {
    const buffer = fs.readFileSync(
        path.join(__dirname, '..', '..', 'assets', filename),
    );
    const mime = ASSET_MIME_TYPES[path.extname(filename).toLowerCase()] || 'image/png';
    return `data:${mime};base64,${buffer.toString('base64')}`;
};

// Mismo logo blanco que usa el panel lateral del login (auth_side_panel_component),
// pre-convertido a PNG porque @react-pdf/renderer no soporta SVG como <Image>.
const LOGO_WHITE_DATA_URI = assetAsDataUri('logo_smid_white.png');
// Misma marca pero en rojo (color de marca), para usar sobre fondos claros.
const LOGO_COLOR_DATA_URI = assetAsDataUri('logo_smid_color.png');
// Insignia de certificación (Google Partner) — versión blanca para fondo rojo,
// versión a color para fondo claro. Ambas subidas directamente a server/assets.
const GOOGLE_PARTNER_DATA_URI = assetAsDataUri('google-partner-white.png');
const GOOGLE_PARTNER_COLOR_DATA_URI = assetAsDataUri('google-partner.jpeg');
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
const BOLIVIA_SVG_RAW = fs.readFileSync(
    path.join(__dirname, '..', '..', 'assets', 'bo.svg'),
    'utf8',
);
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
    const style =
        `<style>path { fill: ${COLORS.grayLight}; stroke: #FFFFFF; stroke-width: 1.5; } ` +
        `${selectedIds.map((id) => `#${id} { fill: ${COLORS.red}; }`).join(' ')}</style>`;
    const svg = BOLIVIA_SVG_RAW.replace(
        '<g id="features">',
        `${style}<g id="features">`,
    );
    const buffer = await sharp(Buffer.from(svg), { density: 150 })
        .resize(640, 640)
        .png()
        .toBuffer();
    return `data:image/png;base64,${buffer.toString('base64')}`;
};

const buildStyles = (StyleSheet) =>
    StyleSheet.create({
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
            padding: 18,
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
            marginBottom: 4,
        },
        kpiObjKpiLine: {
            fontSize: 22,
            fontWeight: 700,
            color: COLORS.black,
            marginBottom: 6,
        },
        kpiObjCaption: {
            fontSize: 16,
            fontWeight: 400,
            color: COLORS.gray,
            lineHeight: 1.25,
        },
        kpiCardExtra: {
            fontSize: 9,
            color: COLORS.gray,
            marginTop: 4,
        },
        // Página "Resumen Ejecutivo de campaña": 3 tarjetas (Objetivo, Inversión
        // Total, Plataformas), cada una con ícono arriba y título debajo.
        resumenTitle: {
            fontSize: 14,
            fontWeight: 700,
            color: COLORS.gray,
            marginBottom: 20,
        },
        resumenCard: {
            flex: 1,
            backgroundColor: COLORS.card,
            borderRadius: 16,
            paddingVertical: 24,
            paddingHorizontal: 22,
            borderStyle: 'solid',
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        resumenCardTitle: {
            fontSize: 22,
            fontWeight: 800,
            color: COLORS.black,
            marginTop: 18,
            marginBottom: 14,
        },
        resumenHeadline: {
            fontSize: 18,
            fontWeight: 700,
            color: COLORS.gray,
            lineHeight: 1.25,
            marginBottom: 6,
        },
        resumenBullet: {
            fontSize: 14,
            fontWeight: 700,
            color: COLORS.black,
            lineHeight: 1.3,
            marginTop: 3,
        },
        resumenMoney: {
            fontSize: 34,
            fontWeight: 800,
            color: COLORS.red,
            lineHeight: 1.1,
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
            marginBottom: 6,
            lineHeight: 1.2,
        },
        // Subtítulo compartido (Resumen Ejecutivo, Mecánica de Inversión) que
        // identifica a cuál tipo de sección corresponde la página — necesario
        // desde que cada tipo (CPC/CPV/CPE vs CPM) pasó a tener su propia página
        // en vez de mezclarse en una sola.
        tipoSectionSubtitle: {
            fontSize: 14,
            fontWeight: 700,
            color: COLORS.gray,
            marginBottom: 20,
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
        // Página "Detalle de Inversión": una sola tabla con los registros del
        // Planificador agrupados por modelo (CPM, CPC, CPV, CPE), dentro de una
        // tarjeta blanca sobre el mismo fondo gris del resto del rediseño.
        detallePage: {
            flexDirection: 'column',
            backgroundColor: COLORS.bg,
            paddingHorizontal: 40,
            paddingTop: 32,
            paddingBottom: 32,
            fontFamily: 'Poppins',
        },
        detalleTitle: {
            fontSize: 26,
            fontWeight: 800,
            color: COLORS.black,
            marginBottom: 14,
        },
        detalleCard: {
            backgroundColor: COLORS.card,
            borderRadius: 14,
            borderStyle: 'solid',
            borderWidth: 1,
            borderColor: COLORS.border,
            overflow: 'hidden',
        },
        detalleHeaderRow: {
            flexDirection: 'row',
            backgroundColor: COLORS.black,
            paddingVertical: 7,
            paddingHorizontal: 12,
        },
        detalleHeaderCell: {
            fontSize: 8,
            fontWeight: 700,
            color: '#FFFFFF',
        },
        detalleGroupRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.bg,
            paddingVertical: 5,
            paddingHorizontal: 12,
        },
        detalleGroupBadge: {
            backgroundColor: COLORS.red,
            borderRadius: 10,
            paddingHorizontal: 9,
            paddingVertical: 2,
            marginRight: 8,
        },
        detalleGroupBadgeText: {
            fontSize: 8,
            fontWeight: 700,
            color: '#FFFFFF',
        },
        detalleGroupLabel: {
            flex: 1,
            fontSize: 8,
            fontWeight: 600,
            color: COLORS.gray,
        },
        detalleGroupSubtotal: {
            fontSize: 8,
            fontWeight: 700,
            color: COLORS.black,
        },
        detalleRow: {
            flexDirection: 'row',
            alignItems: 'center',
            paddingVertical: 6,
            paddingHorizontal: 12,
            borderBottomStyle: 'solid',
            borderBottomWidth: 1,
            borderBottomColor: COLORS.border,
        },
        detalleCell: {
            fontSize: 8.5,
            color: COLORS.black,
        },
        detalleCellBold: {
            fontWeight: 600,
        },
        detalleCellMuted: {
            fontSize: 7.5,
            color: COLORS.gray,
        },
        detalleCellRed: {
            fontWeight: 700,
            color: COLORS.red,
        },
        detalleTotalRow: {
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: COLORS.red,
            paddingVertical: 9,
            paddingHorizontal: 12,
        },
        detalleTotalLabel: {
            flex: 1,
            fontSize: 10,
            fontWeight: 800,
            color: '#FFFFFF',
        },
        detalleTotalValue: {
            fontSize: 12,
            fontWeight: 800,
            color: '#FFFFFF',
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
            marginBottom: 4,
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
            borderRadius: 10,
            backgroundColor: COLORS.red,
        },
        cronogramaSegmentEmpty: {
            width: '100%',
            height: 8,
            borderRadius: 4,
            backgroundColor: COLORS.card,
            borderStyle: 'solid',
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        cronogramaBarArea: {
            width: '100%',
            height: 90,
            justifyContent: 'flex-end',
        },
        cronogramaPctLabel: {
            fontSize: 10,
            fontWeight: 600,
            color: COLORS.gray,
            marginTop: 5,
            textAlign: 'center',
        },
        cronogramaPctLabelActive: {
            color: COLORS.red,
            fontWeight: 700,
        },
        cronogramaMonthRow: {
            flexDirection: 'row',
            gap: 4,
            marginBottom: 10,
        },
        cronogramaMonthCell: {
            backgroundColor: COLORS.black,
            borderRadius: 8,
            paddingVertical: 4,
            alignItems: 'center',
        },
        cronogramaMonthText: {
            fontSize: 10,
            fontWeight: 700,
            color: '#FFFFFF',
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
            marginBottom: 12,
        },
        totalFacturadoCard: {
            width: 380,
            backgroundColor: COLORS.card,
            borderRadius: 16,
            padding: 18,
            borderStyle: 'solid',
            borderWidth: 1,
            borderColor: COLORS.border,
        },
        totalFacturadoRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 6,
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
            marginTop: 4,
            paddingTop: 10,
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
            marginTop: 12,
            maxWidth: 360,
        },
        totalFacturadoLecturaNote: {
            fontSize: 8,
            marginTop: 6,
            maxWidth: 420,
            lineHeight: 1.4,
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
    return num.toLocaleString('es-BO', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
};

// Label legible del tipo de sección — usado como subtítulo en varias páginas
// (Resumen Ejecutivo, Mecánica de Inversión, Costos) para que quede claro a
// cuál de las dos secciones (si el PDF incluye ambas) corresponde esa página.
const getTipoLabel = (tipo) =>
    tipo === 'CPM'
        ? 'Campaña Branding (CPM)'
        : 'Campaña Performance (CPC/CPV/CPE)';

// Fallback cuando una línea no tiene KPI principal/secundario cargado
// (dato legacy con kpi_principal/kpi_secundario = 0) — texto explícito en vez
// de la palabra suelta "Objetivo", que sin contexto no se entendía.
const SIN_KPI_LABEL = 'KPI sin definir';

// Encabezado repetido en todas las páginas de contenido (no en la portada, que
// tiene su propio diseño): barra roja con el título a la izquierda y el logo
// de SMID a la derecha.
const buildPageHeader = (title) =>
    h(
        View,
        { style: styles.pageHeader },
        h(Text, { style: styles.pageHeaderTitle }, title),
        h(Image, { src: LOGO_WHITE_DATA_URI, style: styles.pageHeaderLogo }),
    );

const buildCoverPage = (brief) =>
    h(
        Page,
        { size: PAGE_SIZE, style: styles.coverPage },
        h(
            View,
            { style: styles.coverTopRow },
            h(
                Text,
                { style: styles.coverKicker },
                `${brief.nombre_empresa || ''} / Dashboard de Campaña`,
            ),
            h(
                View,
                { style: styles.coverBadgesRow },
                h(Image, {
                    src: LOGO_COLOR_DATA_URI,
                    style: styles.coverBadgeLogo,
                }),
                h(Image, {
                    src: GOOGLE_PARTNER_COLOR_DATA_URI,
                    style: styles.coverBadgeSmall,
                }),
                h(Image, {
                    src: META_CERTIFIED_DATA_URI,
                    style: styles.coverBadgeSmall,
                }),
                h(Image, {
                    src: SELLO_BOLIVIA_DATA_URI,
                    style: styles.coverBadgeMedal,
                }),
            ),
        ),
        h(
            View,
            { style: styles.coverCenterWrap },
            h(Text, { style: styles.coverTitle }, 'Plan de Medios Online:'),
            h(Text, { style: styles.coverTitle }, brief.nombre_campana || ''),
            h(
                Text,
                { style: styles.coverSubtitle },
                'Resumen Ejecutivo y Mecánica de Inversión',
            ),
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
        h(Circle, {
            cx: 9,
            cy: 15,
            r: 6,
            stroke: COLORS.gray,
            strokeWidth: 2,
            fill: 'none',
        }),
        h(Line, {
            x1: 13.5,
            y1: 10.5,
            x2: 20,
            y2: 4,
            stroke: COLORS.gray,
            strokeWidth: 2,
        }),
        h(Line, {
            x1: 14,
            y1: 4,
            x2: 20,
            y2: 4,
            stroke: COLORS.gray,
            strokeWidth: 2,
        }),
        h(Line, {
            x1: 20,
            y1: 4,
            x2: 20,
            y2: 10,
            stroke: COLORS.gray,
            strokeWidth: 2,
        }),
    ),
    Mujeres: h(
        Svg,
        { viewBox: '0 0 24 24', width: 22, height: 22 },
        h(Circle, {
            cx: 12,
            cy: 8,
            r: 6,
            stroke: COLORS.gray,
            strokeWidth: 2,
            fill: 'none',
        }),
        h(Line, {
            x1: 12,
            y1: 14,
            x2: 12,
            y2: 22,
            stroke: COLORS.gray,
            strokeWidth: 2,
        }),
        h(Line, {
            x1: 8,
            y1: 18,
            x2: 16,
            y2: 18,
            stroke: COLORS.gray,
            strokeWidth: 2,
        }),
    ),
});

// Mapa de Bolivia con pines por ciudad (solo las que tengan coordenadas
// conocidas en CITY_COORDS) + tarjeta de demografía (sexo, edad, intereses).
// Reemplaza la vieja sección "Audiencia" de lista plana. `boliviaMapDataUri`
// viene precalculado (ver renderPlanificadorPdf) porque rasterizar el SVG con
// `sharp` es async y buildDocument/buildAudienciaPage son síncronas.
const buildAudienciaPage = (brief, boliviaMapDataUri) => {
    const sexos = Array.isArray(brief.segmentacion_sexo)
        ? brief.segmentacion_sexo
        : [];
    const edades = Array.isArray(brief.segmentacion_edad)
        ? brief.segmentacion_edad
        : [];
    const intereses = Array.isArray(brief.intereses) ? brief.intereses : [];
    const [interesPrincipal, ...otrosIntereses] = intereses;
    const genderIcons = buildGenderIcons();

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.audienciaPage },
        h(
            Text,
            { style: styles.audienciaTitle },
            'Perfil de Audiencia: ¿A quién impactaremos?',
        ),
        h(
            View,
            { style: styles.audienciaRow },
            h(
                View,
                { style: styles.audienciaMapCol },
                h(
                    View,
                    { style: styles.audienciaMapWrap },
                    h(Image, {
                        src: boliviaMapDataUri,
                        style: styles.audienciaMapImage,
                    }),
                ),
            ),
            h(
                View,
                { style: styles.audienciaCard },
                h(
                    Text,
                    { style: styles.audienciaCardTitle },
                    'Hombres y Mujeres',
                ),
                sexos.length > 0
                    ? h(
                          View,
                          { style: styles.audienciaGenderRow },
                          sexos.map((sexo) =>
                              h(
                                  View,
                                  {
                                      key: sexo,
                                      style: styles.audienciaGenderItem,
                                  },
                                  genderIcons[sexo] || null,
                                  h(
                                      Text,
                                      { style: styles.audienciaGenderLabel },
                                      sexo,
                                  ),
                              ),
                          ),
                      )
                    : null,
                edades.length > 0
                    ? h(
                          View,
                          null,
                          h(
                              Text,
                              { style: styles.audienciaSubLabel },
                              'Rangos de edad',
                          ),
                          h(
                              View,
                              { style: styles.audienciaPillsRow },
                              edades.map((edad) =>
                                  h(
                                      View,
                                      {
                                          key: edad,
                                          style: styles.audienciaPill,
                                      },
                                      h(
                                          Text,
                                          { style: styles.audienciaPillText },
                                          edad,
                                      ),
                                  ),
                              ),
                          ),
                      )
                    : null,
                interesPrincipal
                    ? h(
                          View,
                          null,
                          h(
                              Text,
                              { style: styles.audienciaSubLabel },
                              'Interés principal',
                          ),
                          h(
                              View,
                              { style: styles.audienciaInterestPill },
                              h(
                                  Text,
                                  { style: styles.audienciaInterestPillText },
                                  interesPrincipal,
                              ),
                          ),
                      )
                    : null,
                otrosIntereses.length > 0
                    ? h(
                          View,
                          null,
                          h(
                              Text,
                              { style: styles.audienciaSubLabel },
                              'Otros intereses',
                          ),
                          h(
                              View,
                              { style: styles.audienciaPillsRow },
                              otrosIntereses.map((interes) =>
                                  h(
                                      View,
                                      {
                                          key: interes,
                                          style: styles.audienciaPill,
                                      },
                                      h(
                                          Text,
                                          { style: styles.audienciaPillText },
                                          interes,
                                      ),
                                  ),
                              ),
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
        const plataformaNombre = linea.plataforma
            ? linea.plataforma.plataforma
            : '';
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
            COLUMNS.map((col) =>
                h(
                    Text,
                    {
                        key: col.key,
                        style: [
                            styles.cell,
                            { width: `${col.width * 100}%` },
                            col.key === 'formato' ? styles.cellLeft : null,
                        ],
                    },
                    String(values[col.key] ?? ''),
                ),
            ),
        );
    });

    const totalRow = h(
        View,
        { style: [styles.row, styles.totalRow], key: 'total' },
        h(
            Text,
            {
                style: [
                    styles.cell,
                    {
                        width: `${(COLUMNS[0].width + COLUMNS[1].width) * 100}%`,
                    },
                ],
            },
            'TOTAL',
        ),
        h(
            Text,
            { style: [styles.cell, { width: `${COLUMNS[2].width * 100}%` }] },
            '',
        ),
        h(
            Text,
            { style: [styles.cell, { width: `${COLUMNS[3].width * 100}%` }] },
            formatNumber(totalObjetivo),
        ),
        h(
            Text,
            { style: [styles.cell, { width: `${COLUMNS[4].width * 100}%` }] },
            `${moneda} ${formatNumber(totalInversion)}`,
        ),
        h(
            Text,
            {
                style: [
                    styles.cell,
                    {
                        width: `${(COLUMNS[5].width + COLUMNS[6].width + COLUMNS[7].width) * 100}%`,
                    },
                ],
            },
            '',
        ),
    );

    return h(
        View,
        { style: styles.table },
        h(
            View,
            { style: styles.row },
            COLUMNS.map((col) =>
                h(
                    Text,
                    {
                        key: col.key,
                        style: [
                            styles.headerCell,
                            { width: `${col.width * 100}%` },
                        ],
                    },
                    col.label,
                ),
            ),
        ),
        ...bodyRows,
        totalRow,
    );
};

const MESES_FULL = [
    'Enero',
    'Febrero',
    'Marzo',
    'Abril',
    'Mayo',
    'Junio',
    'Julio',
    'Agosto',
    'Septiembre',
    'Octubre',
    'Noviembre',
    'Diciembre',
];

// Distribución semanal de la inversión (SUMMARY del Planificador): cada línea
// guarda, por mes y por semana, el % de su inversión que se ejecuta esa
// semana (debe sumar 100). Acá se cruza con la inversión de cada línea para
// obtener cuánto dinero cae realmente en cada semana. El orden de los meses es
// el guardado (no se reordena por número, así soporta campañas que cruzan fin
// de año). Devuelve null si ninguna línea tiene distribución, para omitir la
// página.
const getCronogramaSemanas = (lineas, summaryByCosto) => {
    const base = lineas
        .map((l) => summaryByCosto.get(l.id_costo))
        .find((s) => Array.isArray(s) && s.length > 0);
    if (!base) return null;

    const semanas = [];
    base.forEach((mes) => {
        (mes.semanas || []).forEach((_, i) => {
            semanas.push({
                mes: mes.mes,
                semanaDelMes: i + 1,
                inversion: 0,
                aportes: [],
            });
        });
    });

    lineas.forEach((linea) => {
        const summary = summaryByCosto.get(linea.id_costo);
        if (!Array.isArray(summary)) return;
        let idx = 0;
        summary.forEach((mes) => {
            (mes.semanas || []).forEach((semana) => {
                const monto =
                    (Number(linea.inversion) || 0) *
                    ((Number(semana.valor) || 0) / 100);
                if (semanas[idx] && monto > 0) {
                    semanas[idx].inversion += monto;
                    semanas[idx].aportes.push({ linea, monto });
                }
                idx += 1;
            });
        });
    });

    return semanas;
};

// Página "Cronograma de Ejecución": una barra por semana cuya altura es
// proporcional a la inversión que cae en esa semana (según el SUMMARY cargado
// en el Planificador), con el % debajo. El callout destaca la semana de mayor
// concentración y la línea que más aporta ahí.
const buildCronogramaEjecucionPage = (brief, tipo, lineas, summaryByCosto) => {
    const semanas = getCronogramaSemanas(lineas, summaryByCosto);
    if (!semanas) return null;

    const moneda = brief.moneda || '';
    const total = semanas.reduce((acc, s) => acc + s.inversion, 0);
    const maxInversion = Math.max(...semanas.map((s) => s.inversion));
    const pct = (inversion) => (total > 0 ? (inversion / total) * 100 : 0);
    const formatPct = (value) => `${Math.round(value * 10) / 10}%`;
    const BAR_MAX_HEIGHT = 90;

    const mesesOrdenados = [];
    semanas.forEach((s) => {
        const ultimo = mesesOrdenados[mesesOrdenados.length - 1];
        if (ultimo && ultimo.mes === s.mes) ultimo.semanas += 1;
        else mesesOrdenados.push({ mes: s.mes, semanas: 1 });
    });
    const sprintLabel =
        mesesOrdenados.length > 1
            ? `${MESES_FULL[mesesOrdenados[0].mes - 1]} – ${MESES_FULL[mesesOrdenados[mesesOrdenados.length - 1].mes - 1]}`
            : MESES_FULL[mesesOrdenados[0].mes - 1];

    const pico = semanas.reduce(
        (best, s, i) =>
            s.inversion > best.inversion ? { ...s, numero: i + 1 } : best,
        { inversion: -1 },
    );
    const principal = pico.aportes
        .slice()
        .sort((a, b) => b.monto - a.monto)[0]?.linea;
    const principalLabel = principal
        ? `${principal.plataforma?.plataforma ? `${principal.plataforma.plataforma} ` : ''}${principal.nombre}`.trim()
        : null;

    return h(
        Page,
        {
            size: PAGE_SIZE,
            style: styles.cronogramaPage,
            key: `cronograma-${tipo}`,
        },
        h(Text, { style: styles.cronogramaTitle }, 'Cronograma de Ejecución'),
        h(
            Text,
            { style: styles.cronogramaSubtitleBig },
            `Sprint de ${sprintLabel}`,
        ),
        h(Text, { style: styles.tipoSectionSubtitle }, getTipoLabel(tipo)),
        h(
            View,
            { style: styles.cronogramaCenterWrap },
            mesesOrdenados.length > 1
                ? h(
                      View,
                      { style: styles.cronogramaMonthRow },
                      mesesOrdenados.map((m, i) =>
                          h(
                              View,
                              {
                                  key: i,
                                  style: [
                                      styles.cronogramaMonthCell,
                                      { flex: m.semanas },
                                  ],
                              },
                              h(
                                  Text,
                                  { style: styles.cronogramaMonthText },
                                  MESES_FULL[m.mes - 1],
                              ),
                          ),
                      ),
                  )
                : null,
            h(
                View,
                { style: styles.cronogramaBarRow },
                semanas.map((s, i) =>
                    h(
                        View,
                        { key: i, style: styles.cronogramaSegmentWrap },
                        h(
                            Text,
                            { style: styles.cronogramaWeekLabel },
                            `Semana ${i + 1}`,
                        ),
                        h(
                            View,
                            { style: styles.cronogramaBarArea },
                            s.inversion > 0
                                ? h(View, {
                                      style: [
                                          styles.cronogramaSegmentActive,
                                          {
                                              height: Math.max(
                                                  10,
                                                  (s.inversion / maxInversion) *
                                                      BAR_MAX_HEIGHT,
                                              ),
                                          },
                                      ],
                                  })
                                : h(View, {
                                      style: styles.cronogramaSegmentEmpty,
                                  }),
                        ),
                        h(
                            Text,
                            {
                                style: [
                                    styles.cronogramaPctLabel,
                                    s.inversion > 0
                                        ? styles.cronogramaPctLabelActive
                                        : null,
                                ],
                            },
                            s.inversion > 0 ? formatPct(pct(s.inversion)) : '—',
                        ),
                    ),
                ),
            ),
            pico.inversion > 0
                ? h(
                      View,
                      { style: styles.cronogramaCallout },
                      h(
                          Text,
                          { style: styles.cronogramaCalloutTitle },
                          'Concentración de Impacto',
                      ),
                      h(
                          Text,
                          { style: styles.cronogramaCalloutText },
                          `${formatPct(pct(pico.inversion))} de la inversión (${moneda} ${formatNumber(pico.inversion)}) se ejecuta en la Semana ${pico.numero}${principalLabel ? `, principalmente en ${principalLabel}` : ''}.`,
                      ),
                  )
                : null,
        ),
    );
};

// Flecha roja (cuerpo + punta) entre tarjetas del embudo — dibujada con los
// primitivos SVG, mismo criterio que los íconos del Resumen Ejecutivo (no
// hace falta un asset nuevo para esto).
const buildFunnelArrow = () =>
    h(
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
const buildPresupuestoCard = (moneda, inversion) =>
    h(
        View,
        { style: styles.mecanicaCard },
        h(
            Text,
            { style: styles.mecanicaBigValue },
            `${moneda} ${formatNumber(inversion)}`,
        ),
        h(Text, { style: styles.mecanicaCaption }, 'Presupuesto asignado'),
    );

// Card 2: "Plataforma" + nombre real, y viñetas con el modelo de costo, el
// costo proyectado y la frecuencia de esa línea. El modelo se muestra
// genérico por tipo de sección (CPC/CPV/CPE vs CPM) — el dato real no distingue
// CPC de CPV/CPE/CPD por línea, así que no se inventa.
const buildPlataformaCard = (linea, tipo, moneda) => {
    const modeloLabel =
        tipo === 'CPM'
            ? 'Modelo CPM (Costo por Mil Impresiones)'
            : 'Modelo CPC/CPV/CPE (Costo por Clic, View o Engagement)';
    const unidad =
        tipo === 'CPM' ? 'por mil impresiones' : 'por clic/view/engagement';
    return h(
        View,
        { style: styles.mecanicaCard },
        h(Text, { style: styles.mecanicaPlatformLabel }, 'Plataforma'),
        h(
            Text,
            { style: styles.mecanicaPlatformName },
            linea.plataforma ? linea.plataforma.plataforma : '—',
        ),
        h(
            View,
            { style: styles.mecanicaBulletsWrap },
            h(Text, { style: styles.mecanicaBulletText }, `• ${modeloLabel}`),
            h(
                Text,
                { style: styles.mecanicaBulletText },
                `• Costo proyectado: ${moneda} ${formatNumber(linea.costo)} ${unidad}`,
            ),
            h(
                Text,
                { style: styles.mecanicaBulletText },
                `• Frecuencia: ${linea.frecuencia}`,
            ),
        ),
    );
};

// Card 3: el número alcanzado (rojo) + el nombre del KPI principal (negro,
// mismo tamaño que el nombre de plataforma de la card 2) + leyenda fija.
const buildObjetivoAlcanzadoCard = (objetivo, kpiPrincipal) =>
    h(
        View,
        { style: styles.mecanicaCard },
        h(Text, { style: styles.mecanicaBigValue }, formatNumber(objetivo)),
        h(Text, { style: styles.mecanicaKpiLabel }, kpiPrincipal),
        h(Text, { style: styles.mecanicaCaption }, 'KPI Principal alcanzado'),
    );

// Card 4: solo el nombre del KPI secundario (sin número — performance_branding
// no guarda una cifra separada para el KPI secundario) + leyenda fija de 2
// líneas.
const buildKpiSecundarioCard = (kpiSecundario) =>
    h(
        View,
        { style: styles.mecanicaCard },
        h(Text, { style: styles.mecanicaKpiLabel }, kpiSecundario),
        h(
            Text,
            { style: styles.mecanicaCaption },
            'KPI Secundario\n(Conversiones)',
        ),
    );

// Embudo de 4 tarjetas (Presupuesto → Plataforma y Modelo → Objetivo
// Alcanzado → KPI Secundario) repetido una vez por línea de cotización —
// decisión ya confirmada con el usuario: no se resume en un solo embudo
// porque cada línea puede perseguir plataformas/KPIs distintos entre sí.
const buildFunnelRow = (linea, tipo, moneda, objetivosById) => {
    const kpiPrincipal =
        objetivosById.get(linea.kpi_principal) || SIN_KPI_LABEL;
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
        {
            size: PAGE_SIZE,
            style: styles.mecanicaPage,
            key: `mecanica-${tipo}`,
        },
        h(
            Text,
            { style: styles.mecanicaTitle },
            'Mecánica de Inversión:\nEl Embudo de Rendimiento',
        ),
        h(Text, { style: styles.tipoSectionSubtitle }, getTipoLabel(tipo)),
        h(
            View,
            { style: styles.mecanicaCenterWrap },
            ...lineas.map((linea) =>
                buildFunnelRow(linea, tipo, moneda, objetivosById),
            ),
        ),
    );
};

// Página "Detalle de Inversión": reemplaza a la Mecánica de Inversión (embudos
// por línea, buildMecanicaInversionPage sigue definida pero ya no se llama) con
// una única tabla. Orden fijo: CPM primero y luego CPC, CPV, CPE — solo
// aparecen los grupos que tienen líneas, es decir, los tipos tildados al
// generar el PDF. Las líneas CPC_CPV cuyo costo aún no tiene `modelo`
// definido en la administración van al final como "CPC/CPV/CPE".
const DETALLE_GRUPOS = [
    { key: 'CPM', label: 'Costo por Mil Impresiones' },
    { key: 'CPC', label: 'Costo por Clic' },
    { key: 'CPV', label: 'Costo por View' },
    { key: 'CPE', label: 'Costo por Engagement' },
    { key: 'CPC/CPV/CPE', label: 'Modelo sin definir' },
];

const DETALLE_COLS = [
    { key: 'plataforma', label: 'PLATAFORMA', width: 0.17 },
    { key: 'formato', label: 'FORMATO', width: 0.23 },
    { key: 'costo', label: 'COSTO UNIT.', width: 0.11, align: 'right' },
    {
        key: 'objetivo',
        label: 'OBJETIVO (KPI PRINCIPAL)',
        width: 0.22,
        align: 'right',
    },
    { key: 'frecuencia', label: 'FRECUENCIA', width: 0.11, align: 'center' },
    { key: 'inversion', label: 'INVERSIÓN', width: 0.16, align: 'right' },
];

const getDetalleGrupoKey = (tipo, linea) => {
    if (tipo === 'CPM') return 'CPM';
    return ['CPC', 'CPV', 'CPE'].includes(linea.modelo)
        ? linea.modelo
        : 'CPC/CPV/CPE';
};

const buildDetalleInversionPage = (brief, secciones, objetivosById) => {
    const moneda = brief.moneda || '';
    const porGrupo = new Map(DETALLE_GRUPOS.map((g) => [g.key, []]));
    secciones.forEach((s) =>
        s.lineas.forEach((linea) => {
            porGrupo.get(getDetalleGrupoKey(s.tipo, linea)).push(linea);
        }),
    );
    const grupos = DETALLE_GRUPOS.filter((g) => porGrupo.get(g.key).length > 0);

    const cellStyle = (col, extra) => [
        styles.detalleCell,
        { width: `${col.width * 100}%`, textAlign: col.align || 'left' },
        extra,
    ];

    const rows = grupos.flatMap((grupo) => {
        const lineas = porGrupo.get(grupo.key);
        const subtotal = sumInversion(lineas);
        return [
            h(
                View,
                {
                    key: `g-${grupo.key}`,
                    style: styles.detalleGroupRow,
                    wrap: false,
                    minPresenceAhead: 40,
                },
                h(
                    View,
                    { style: styles.detalleGroupBadge },
                    h(Text, { style: styles.detalleGroupBadgeText }, grupo.key),
                ),
                h(Text, { style: styles.detalleGroupLabel }, grupo.label),
                h(
                    Text,
                    { style: styles.detalleGroupSubtotal },
                    `Subtotal: ${moneda} ${formatNumber(subtotal)}`,
                ),
            ),
            ...lineas.map((linea) => {
                const kpi =
                    objetivosById.get(linea.kpi_principal) || SIN_KPI_LABEL;
                const values = {
                    plataforma: linea.plataforma
                        ? linea.plataforma.plataforma
                        : '—',
                    formato: linea.nombre,
                    costo: `${moneda} ${formatNumber(linea.costo)}`,
                    objetivo: `${formatNumber(linea.objetivo)} ${kpi}`,
                    frecuencia: linea.frecuencia,
                    inversion: `${moneda} ${formatNumber(linea.inversion)}`,
                };
                return h(
                    View,
                    {
                        key: `l-${linea.id}`,
                        style: styles.detalleRow,
                        wrap: false,
                    },
                    DETALLE_COLS.map((col) =>
                        h(
                            Text,
                            {
                                key: col.key,
                                style: cellStyle(
                                    col,
                                    col.key === 'plataforma' ||
                                        col.key === 'inversion'
                                        ? styles.detalleCellBold
                                        : null,
                                ),
                            },
                            String(values[col.key] ?? ''),
                        ),
                    ),
                );
            }),
        ];
    });

    const granTotal = grupos.reduce(
        (acc, g) => acc + sumInversion(porGrupo.get(g.key)),
        0,
    );

    return h(
        Page,
        {
            size: PAGE_SIZE,
            style: styles.detallePage,
            key: 'detalle-inversion',
            wrap: true,
        },
        h(Text, { style: styles.detalleTitle }, 'Detalle de Inversión'),
        h(
            View,
            { style: styles.detalleCard },
            h(
                View,
                { style: styles.detalleHeaderRow, fixed: true },
                DETALLE_COLS.map((col) =>
                    h(
                        Text,
                        {
                            key: col.key,
                            style: [
                                styles.detalleHeaderCell,
                                {
                                    width: `${col.width * 100}%`,
                                    textAlign: col.align || 'left',
                                },
                            ],
                        },
                        col.label,
                    ),
                ),
            ),
            ...rows,
            h(
                View,
                { style: styles.detalleTotalRow, wrap: false },
                h(Text, { style: styles.detalleTotalLabel }, 'INVERSIÓN TOTAL'),
                h(
                    Text,
                    { style: styles.detalleTotalValue },
                    `${moneda} ${formatNumber(granTotal)}`,
                ),
            ),
        ),
    );
};

// Página de Costos — el Cronograma ahora vive en su propia página
// (buildCronogramaEjecucionPage, la barra de semanas) como parte del
// rediseño.
const buildCostosPage = (brief, tipo, lineas, objetivosById) => {
    const tipoLabel = getTipoLabel(tipo);

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.page, key: `costos-${tipo}` },
        buildPageHeader(`Costos / Costs — ${tipoLabel}`),
        h(
            View,
            { style: styles.pageBody },
            h(
                Text,
                { style: [styles.sectionSubtitle, { marginTop: 0 }] },
                'Costos / Costs',
            ),
            buildCostosTable(brief, lineas, objetivosById),
        ),
    );
};

const sumInversion = (lineas) =>
    lineas.reduce((acc, l) => acc + (Number(l.inversion) || 0), 0);

// Los 4 modelos de costo que explica el Glosario.
const MODELOS_GLOSARIO = [
    {
        code: 'CPC',
        nombre: 'Costo por Clic',
        desc: 'Se paga por cada clic único de un usuario en el anuncio.',
    },
    {
        code: 'CPV',
        nombre: 'Costo por View',
        desc: 'Se paga por cada visualización completa de un video.',
    },
    {
        code: 'CPE',
        nombre: 'Costo por Engagement',
        desc: 'Se paga por cada interacción (like, comentario, compartir) con el anuncio.',
    },
    {
        code: 'CPM',
        nombre: 'Costo por Mil Impresiones',
        desc: 'Se paga por cada mil veces que se muestra el anuncio.',
    },
];

// Página "Glosario de Objetivos": grid 2x2 con los 4 modelos de costo,
// marcando con una insignia solo los que están realmente en la tabla del
// Planificador: CPM si hay líneas CPM, y CPC/CPV/CPE según el `modelo` de
// cada línea CPC_CPV (las líneas con modelo sin definir no marcan ninguno).
const buildGlosarioPage = (secciones) => {
    const presentes = new Set();
    secciones.forEach((s) =>
        s.lineas.forEach((l) => {
            presentes.add(s.tipo === 'CPM' ? 'CPM' : l.modelo);
        }),
    );
    const modelos = MODELOS_GLOSARIO.map((m) => ({
        ...m,
        seleccionado: presentes.has(m.code),
    }));

    const buildCard = (m) =>
        h(
            View,
            {
                key: m.code,
                style: [
                    styles.glosarioCard,
                    m.seleccionado && styles.glosarioCardSelected,
                ],
            },
            m.seleccionado
                ? h(
                      View,
                      { style: styles.glosarioBadge },
                      h(
                          Text,
                          { style: styles.glosarioBadgeText },
                          'Modelo Seleccionado',
                      ),
                  )
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
            h(
                View,
                { style: styles.glosarioRow },
                buildCard(modelos[0]),
                buildCard(modelos[1]),
            ),
            h(
                View,
                { style: styles.glosarioRow },
                buildCard(modelos[2]),
                buildCard(modelos[3]),
            ),
        ),
    );
};

// Ícono de candado (SVG) para la página final de Total Facturado.
const buildLockIcon = () =>
    h(
        Svg,
        { viewBox: '0 0 24 24', width: 48, height: 48 },
        h(Path, {
            d: 'M8 11 V8 a4 4 0 0 1 8 0 v3',
            fill: 'none',
            stroke: COLORS.gray,
            strokeWidth: 2,
        }),
        h(Rect, {
            x: 5,
            y: 11,
            width: 14,
            height: 10,
            rx: 2,
            fill: COLORS.gray,
        }),
        h(Circle, { cx: 12, cy: 16, r: 1.6, fill: COLORS.card }),
    );

// Página final "Total Facturado": candado + tarjeta con el desglose por tipo
// y el gran total. El glosario de modelos (CPC/CPV/CPE/CPM) se mudó a su
// propia página — ya no repite esa explicación acá.
const buildTotalFacturadoPage = (brief, secciones) => {
    const moneda = brief.moneda || '';
    const totalesPorTipo = secciones.map((s) => ({
        tipo: s.tipo,
        total: sumInversion(s.lineas),
    }));
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
                totalesPorTipo.map((t) =>
                    h(
                        View,
                        { key: t.tipo, style: styles.totalFacturadoRow },
                        h(
                            Text,
                            { style: styles.totalFacturadoRowLabel },
                            t.tipo === 'CPM'
                                ? 'Campaña Branding'
                                : 'Campaña Performance',
                        ),
                        h(
                            Text,
                            { style: styles.totalFacturadoRowValue },
                            `${moneda} ${formatNumber(t.total)}`,
                        ),
                    ),
                ),
                h(
                    View,
                    { style: styles.totalFacturadoGrandRow },
                    h(
                        Text,
                        { style: styles.totalFacturadoGrandLabel },
                        'Monto Total Facturado',
                    ),
                    h(
                        Text,
                        { style: styles.totalFacturadoGrandValue },
                        `${moneda} ${formatNumber(granTotal)}`,
                    ),
                ),
            ),
            h(
                Text,
                { style: styles.totalFacturadoNote },
                'El monto total facturado incluye los costos por los servicios de SMID Media Center.',
            ),
            h(
                Text,
                {
                    style: [
                        styles.totalFacturadoNote,
                        styles.totalFacturadoLecturaNote,
                    ],
                },
                'LECTURA DE PROPUESTA: Todos los costos están expresados en Dólares Americanos ($us) e incluyen todos los costos e impuestos de ley.',
            ),
        ),
    );
};

const formatInt = (value) =>
    Math.round(Number(value) || 0).toLocaleString('es-BO');

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
        h(Path, {
            d: 'M4 2 L4 20 L9 16 L12 22 L15 20.5 L12 14.5 L19 14.5 Z',
            fill: COLORS.gray,
        }),
    ),
    person: h(
        Svg,
        { viewBox: '0 0 24 24', width: 32, height: 32 },
        h(Circle, { cx: 12, cy: 7, r: 4, fill: COLORS.gray }),
        h(Path, {
            d: 'M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8',
            fill: 'none',
            stroke: COLORS.gray,
            strokeWidth: 2,
        }),
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
        const label = objetivosById.get(linea[kpiField]) || SIN_KPI_LABEL;
        map.set(label, (map.get(label) || 0) + (Number(linea.objetivo) || 0));
    });
    return [...map.entries()]
        .map(([label, total]) => ({ label, total }))
        .sort((a, b) => b.total - a.total);
};

// Tope de líneas "+N {KPI}" que se muestran en las cards de Objetivo — una
// cotización puede tener muchas líneas con KPIs distintos entre sí, y esa
// lista no tiene límite natural (a diferencia del resto del contenido de la
// card, que siempre mide lo mismo). Sin un tope, una cotización con muchas
// líneas puede hacer crecer la card lo suficiente para desbordar la página
// (el resto se corta a la página siguiente, dejando una página casi vacía).
const MAX_EXTRA_KPIS = 2;

// Tarjeta de objetivo (card 2 y 3): ícono gris, título normal, "Generación de
// {KPI}" (nombre real del KPI principal/secundario cargado en la línea de
// cotización) en negrita, y un texto de cierre — con el número incluido ahí
// mismo (mismo tamaño/color que el texto, sin negrita ni rojo) cuando
// corresponde mostrarlo. El card de Objetivo Secundario no lleva número,
// solo el texto fijo de cierre.
const buildObjetivoCard = ({
    icon,
    cardLabel,
    kpiLabel,
    captionText,
    extra,
}) => {
    const extraVisible = (extra || []).slice(0, MAX_EXTRA_KPIS);
    const extraRestantes = (extra || []).length - extraVisible.length;

    return h(
        View,
        { style: styles.kpiCard },
        icon,
        h(Text, { style: [styles.kpiObjTitle, { marginTop: 14 }] }, cardLabel),
        h(Text, { style: styles.kpiObjKpiLine }, `Generación de ${kpiLabel}`),
        h(Text, { style: styles.kpiObjCaption }, captionText),
        extraVisible.length > 0
            ? h(
                  View,
                  { style: { marginTop: 6 } },
                  extraVisible.map((e, i) =>
                      h(
                          Text,
                          { key: i, style: styles.kpiCardExtra },
                          `+ ${formatInt(e.total)} ${e.label}`,
                      ),
                  ),
                  extraRestantes > 0
                      ? h(
                            Text,
                            { style: styles.kpiCardExtra },
                            `+ ${extraRestantes} KPI${extraRestantes > 1 ? 's' : ''} más`,
                        )
                      : null,
              )
            : null,
    );
};

// Página "Resumen Ejecutivo": 3 tarjetas de alto nivel (inversión total,
// objetivo principal, objetivo secundario) — una página por tipo de sección
// (igual que Mecánica/Cronograma/Costos), nunca mezclando CPC/CPV/CPE con
// CPM en un mismo total: son unidades distintas y mezclarlas no se entendía.
const buildKpiResumenPage = (brief, tipo, lineas, objetivosById) => {
    const moneda = brief.moneda || '';
    const granTotal = sumInversion(lineas);
    const principalGroups = buildKpiGroups(
        lineas,
        'kpi_principal',
        objetivosById,
    );
    const secundarioGroups = buildKpiGroups(
        lineas,
        'kpi_secundario',
        objetivosById,
    );
    const icons = buildKpiIcons();
    const principal = principalGroups[0];
    const secundario = secundarioGroups[0];

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.kpiPage, key: `kpi-${tipo}` },
        h(
            Text,
            { style: styles.tipoSectionSubtitle },
            `Resumen Ejecutivo — ${getTipoLabel(tipo)}`,
        ),
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
                    h(
                        Text,
                        { style: styles.kpiCardValue },
                        `${moneda} ${formatNumber(granTotal)}`,
                    ),
                ),
                buildObjetivoCard({
                    icon: icons.cursor,
                    cardLabel: 'Objetivo Principal',
                    kpiLabel: principal?.label || SIN_KPI_LABEL,
                    captionText: principal
                        ? `${formatInt(principal.total)} interacciones únicas estimadas.`
                        : 'interacciones únicas estimadas.',
                    extra: principalGroups.slice(1),
                }),
                buildObjetivoCard({
                    icon: icons.person,
                    cardLabel: 'Objetivo Secundario',
                    kpiLabel: secundario?.label || SIN_KPI_LABEL,
                    captionText:
                        'El tráfico generado alimentará la base de contactos.',
                    extra: secundarioGroups.slice(1),
                }),
            ),
        ),
    );
};

// Íconos de las 3 tarjetas del Resumen Ejecutivo, en gris oscuro (como en el
// diseño aprobado). Son funciones por el mismo motivo que `buildKpiIcons`.
const RESUMEN_ICON_COLOR = '#3A3A3A';
const buildResumenIcons = () => ({
    objetivo: h(
        Svg,
        { viewBox: '0 0 48 48', width: 46, height: 46 },
        h(Circle, {
            cx: 24,
            cy: 24,
            r: 20,
            fill: 'none',
            stroke: RESUMEN_ICON_COLOR,
            strokeWidth: 4,
        }),
        h(Circle, {
            cx: 24,
            cy: 24,
            r: 12,
            fill: 'none',
            stroke: RESUMEN_ICON_COLOR,
            strokeWidth: 4,
        }),
        h(Circle, { cx: 24, cy: 24, r: 5, fill: RESUMEN_ICON_COLOR }),
    ),
    inversion: h(
        Svg,
        { viewBox: '0 0 48 48', width: 46, height: 46 },
        h(Rect, {
            x: 4,
            y: 34,
            width: 14,
            height: 5,
            rx: 2,
            fill: RESUMEN_ICON_COLOR,
        }),
        h(Rect, {
            x: 4,
            y: 27,
            width: 14,
            height: 5,
            rx: 2,
            fill: RESUMEN_ICON_COLOR,
        }),
        h(Rect, {
            x: 20,
            y: 34,
            width: 14,
            height: 5,
            rx: 2,
            fill: RESUMEN_ICON_COLOR,
        }),
        h(Rect, {
            x: 20,
            y: 27,
            width: 14,
            height: 5,
            rx: 2,
            fill: RESUMEN_ICON_COLOR,
        }),
        h(Rect, {
            x: 20,
            y: 20,
            width: 14,
            height: 5,
            rx: 2,
            fill: RESUMEN_ICON_COLOR,
        }),
        h(Path, {
            d: 'M6 22 L20 12 L28 16 L40 6',
            fill: 'none',
            stroke: RESUMEN_ICON_COLOR,
            strokeWidth: 3.5,
        }),
        h(Path, { d: 'M32 5 L43 4 L42 15 Z', fill: RESUMEN_ICON_COLOR }),
    ),
    plataformas: h(
        Svg,
        { viewBox: '0 0 48 48', width: 46, height: 46 },
        h(Path, { d: 'M24 3 L44 11 L24 19 L4 11 Z', fill: RESUMEN_ICON_COLOR }),
        h(Path, {
            d: 'M4 20 L24 28 L44 20',
            fill: 'none',
            stroke: RESUMEN_ICON_COLOR,
            strokeWidth: 4,
        }),
        h(Path, {
            d: 'M4 29 L24 37 L44 29',
            fill: 'none',
            stroke: RESUMEN_ICON_COLOR,
            strokeWidth: 4,
        }),
        h(Path, {
            d: 'M4 38 L24 46 L44 38',
            fill: 'none',
            stroke: RESUMEN_ICON_COLOR,
            strokeWidth: 4,
        }),
    ),
});

// Tope de plataformas listadas en la tarjeta — el resto se resume en "+N más"
// para que la tarjeta no desborde la página.
const MAX_PLATAFORMAS_RESUMEN = 7;

// Página 2 "Resumen Ejecutivo de campaña": una sola página para todo el PDF
// (no una por tipo). Objetivo = descripción de la estrategia escrita antes de
// descargar (guardada en el brief); si no hay, cae al KPI principal con más
// volumen. Inversión Total = suma de TODAS las secciones incluidas (CPM +
// CPC/CPV/CPE). Plataformas = las de las líneas tildadas en el Planificador.
const buildResumenEjecutivoPage = (brief, secciones, objetivosById) => {
    const moneda = brief.moneda || '';
    const lineas = secciones.flatMap((s) => s.lineas);
    const granTotal = sumInversion(lineas);
    const icons = buildResumenIcons();

    const plataformas = [
        ...new Set(lineas.map((l) => l.plataforma?.plataforma).filter(Boolean)),
    ];
    const plataformasVisibles = plataformas.slice(0, MAX_PLATAFORMAS_RESUMEN);
    const plataformasRestantes =
        plataformas.length - plataformasVisibles.length;

    // Viñetas: una línea que empieza con "-", "•" o "*", o un " -texto" dentro
    // de la misma línea (guion precedido de espacio y pegado al texto, así
    // "e-commerce" o "Meta - Google" no se parten). Lo anterior a la primera
    // viñeta es el titular.
    const estrategiaLineas = String(brief.estrategia || '')
        .replace(/[ \t]+([-•*])(?=\S)/g, '\n$1')
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean);
    const esViñeta = (l) => /^[-•*]\s*/.test(l);
    const headline = estrategiaLineas.filter((l) => !esViñeta(l));
    const bullets = estrategiaLineas
        .filter(esViñeta)
        .map((l) => l.replace(/^[-•*]\s*/, ''));
    if (estrategiaLineas.length === 0) {
        const principal = buildKpiGroups(
            lineas,
            'kpi_principal',
            objetivosById,
        )[0];
        headline.push(`Generación de ${principal?.label || SIN_KPI_LABEL}`);
    }

    return h(
        Page,
        { size: PAGE_SIZE, style: styles.kpiPage, key: 'resumen-ejecutivo' },
        h(Text, { style: styles.resumenTitle }, 'Resumen Ejecutivo de campaña'),
        h(
            View,
            { style: styles.kpiCenterWrap },
            h(
                View,
                { style: styles.kpiCardsRow },
                h(
                    View,
                    { style: styles.resumenCard },
                    icons.objetivo,
                    h(Text, { style: styles.resumenCardTitle }, 'Objetivo'),
                    headline.map((l, i) =>
                        h(
                            Text,
                            { key: `h-${i}`, style: styles.resumenHeadline },
                            l,
                        ),
                    ),
                    bullets.map((l, i) =>
                        h(
                            Text,
                            { key: `b-${i}`, style: styles.resumenBullet },
                            `• ${l}`,
                        ),
                    ),
                ),
                h(
                    View,
                    { style: styles.resumenCard },
                    icons.inversion,
                    h(
                        Text,
                        { style: styles.resumenCardTitle },
                        'Inversión Total',
                    ),
                    h(
                        Text,
                        { style: styles.resumenMoney },
                        `${moneda} ${formatNumber(granTotal)}`,
                    ),
                ),
                h(
                    View,
                    { style: styles.resumenCard },
                    icons.plataformas,
                    h(Text, { style: styles.resumenCardTitle }, 'Plataformas'),
                    plataformasVisibles.map((p) =>
                        h(
                            Text,
                            { key: p, style: styles.resumenBullet },
                            `• ${p}`,
                        ),
                    ),
                    plataformasRestantes > 0
                        ? h(
                              Text,
                              {
                                  style: [
                                      styles.resumenBullet,
                                      { color: COLORS.gray },
                                  ],
                              },
                              `+ ${plataformasRestantes} más`,
                          )
                        : null,
                ),
            ),
        ),
    );
};

const buildDocument = ({
    brief,
    secciones,
    objetivosById,
    boliviaMapDataUri,
}) =>
    h(
        Document,
        null,
        buildCoverPage(brief),
        buildResumenEjecutivoPage(brief, secciones, objetivosById),
        buildAudienciaPage(brief, boliviaMapDataUri),
        buildDetalleInversionPage(brief, secciones, objetivosById),
        ...secciones
            .map((s) =>
                buildCronogramaEjecucionPage(
                    brief,
                    s.tipo,
                    s.lineas,
                    s.summaryByCosto || new Map(),
                ),
            )
            .filter(Boolean),
        // La página de Costos (tabla CPC/CPV/CPE + CPM) se quitó del PDF a pedido del
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
    const ciudades = Array.isArray(args.brief.geolocalizacion_ciudad)
        ? args.brief.geolocalizacion_ciudad
        : [];
    const deptIds = [
        ...new Set(ciudades.map((c) => DEPARTAMENTO_SVG_ID[c]).filter(Boolean)),
    ];
    const boliviaMapDataUri = await buildBoliviaMapDataUri(deptIds);
    return renderToBuffer(buildDocument({ ...args, boliviaMapDataUri }));
};

module.exports = { renderPlanificadorPdf };
