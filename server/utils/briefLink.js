const crypto = require('crypto');

// Código de acceso a un brief para links sin login (botón de la plantilla de WhatsApp):
//     <firma>-<id>        ej. a3f9c2d1e8b74c21f0aa91d2-1640
// La firma es un HMAC del ID con un secreto del servidor, así que el link de un brief no sirve para
// abrir otro. No se guarda nada en la base de datos; cambiar el secreto invalida todos los links.
// Usa BRIEF_LINK_SECRET y, si no está definido, SESSION_SECRET (con otro prefijo de derivación).
const SIGNATURE_LENGTH = 24;

const getSecret = () => {
    const secret = process.env.BRIEF_LINK_SECRET || process.env.SESSION_SECRET;
    if (!secret) throw new Error('Falta BRIEF_LINK_SECRET (o SESSION_SECRET) para firmar los links de brief');
    return secret;
};

const sign = (id) => crypto
    .createHmac('sha256', getSecret())
    .update(`brief-link:${id}`)
    .digest('hex')
    .slice(0, SIGNATURE_LENGTH);

const buildBriefCode = (id) => `${sign(id)}-${id}`;

// Devuelve el ID del brief si el código es válido, o null si no (formato o firma incorrectos).
const verifyBriefCode = (code) => {
    const match = /^([a-f0-9]{24})-(\d{1,10})$/.exec(String(code ?? ''));
    if (!match) return null;
    const [, signature, id] = match;
    const expected = Buffer.from(sign(id));
    const received = Buffer.from(signature);
    return crypto.timingSafeEqual(expected, received) ? Number(id) : null;
};

// URL pública de solo lectura del brief (la misma que lleva el botón de la plantilla de WhatsApp).
const buildBriefUrl = (id) => `${process.env.FRONT_URL}/brief/view/${buildBriefCode(id)}`;

module.exports = { buildBriefCode, verifyBriefCode, buildBriefUrl };
