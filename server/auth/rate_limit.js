'use strict';

/**
 * Limitador de peticiones por IP, en memoria (sin dependencias). Pensado para
 * endpoints públicos de escritura (ej. el formulario de brief). Al reiniciar el
 * proceso (pm2 reload) los contadores se reinician; para este uso es suficiente.
 * `app.set('trust proxy', 1)` ya está configurado, así que `req.ip` es la IP real.
 * @param {{ windowMs: number, max: number, message?: string }} options
 * @returns {function} Middleware de Express
 */
const rateLimit = ({ windowMs, max, message = 'Demasiadas solicitudes. Intente nuevamente más tarde.' }) => {
    const hits = new Map(); // ip -> { count, resetAt }

    // Limpia entradas vencidas para que el mapa no crezca indefinidamente.
    setInterval(() => {
        const now = Date.now();
        for (const [ip, entry] of hits) {
            if (entry.resetAt <= now) hits.delete(ip);
        }
    }, windowMs).unref();

    return (req, res, next) => {
        const now = Date.now();
        const entry = hits.get(req.ip);
        if (!entry || entry.resetAt <= now) {
            hits.set(req.ip, { count: 1, resetAt: now + windowMs });
            return next();
        }
        if (entry.count >= max) {
            res.setHeader('Retry-After', Math.ceil((entry.resetAt - now) / 1000));
            return res.status(429).json({ message });
        }
        entry.count += 1;
        next();
    };
};

module.exports = { rateLimit };
