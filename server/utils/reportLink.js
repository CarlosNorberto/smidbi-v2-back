const crypto = require('crypto');

// Token de acceso a un reporte para links sin login (botón de la plantilla de WhatsApp "reporte_creado"):
//     <firma>-<id>        ej. a3f9c2d1e8b74c21f0aa91d2-5821
// Lleva dentro el ID del reporte y una firma HMAC de ese ID con un secreto del servidor, así que el token
// de un reporte no sirve para abrir otro ni se puede inventar. No se guarda nada en la base de datos;
// cambiar el secreto invalida todos los links ya enviados. Mismo mecanismo que utils/briefLink.js, con otro
// prefijo de derivación (un token de brief nunca sirve como token de reporte).
// Usa REPORT_LINK_SECRET y, si no está definido, BRIEF_LINK_SECRET o SESSION_SECRET.
const SIGNATURE_LENGTH = 24;

const getSecret = () => {
    const secret = process.env.REPORT_LINK_SECRET || process.env.BRIEF_LINK_SECRET || process.env.SESSION_SECRET;
    if (!secret) throw new Error('Falta REPORT_LINK_SECRET (o SESSION_SECRET) para firmar los links de reporte');
    return secret;
};

const sign = (id) => crypto
    .createHmac('sha256', getSecret())
    .update(`report-link:${id}`)
    .digest('hex')
    .slice(0, SIGNATURE_LENGTH);

const buildReportToken = (id) => `${sign(id)}-${id}`;

// Si la URL del botón de la plantilla quedó registrada en Meta con el texto "{{1}}" como parte de la URL fija
// (en vez de como variable), Meta lo deja escrito tal cual y agrega el token después. Se ignora ese prefijo
// para que esos links funcionen igual (mismo criterio que en briefLink.js).
const TEMPLATE_PLACEHOLDER_PREFIX = /^(?:\{\{\s*\d+\s*\}\})+/;

// Devuelve el ID del reporte si el token es válido, o null si no (formato o firma incorrectos).
const verifyReportToken = (token) => {
    const clean = String(token ?? '').trim().replace(TEMPLATE_PLACEHOLDER_PREFIX, '');
    const match = /^([a-f0-9]{24})-(\d{1,10})$/.exec(clean);
    if (!match) return null;
    const [, signature, id] = match;
    const expected = Buffer.from(sign(id));
    const received = Buffer.from(signature);
    return crypto.timingSafeEqual(expected, received) ? Number(id) : null;
};

module.exports = { buildReportToken, verifyReportToken };
