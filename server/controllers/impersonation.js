const md = require('../models');
const { logStart, logExit } = require('../services/impersonationService');

// "Ingresar como" (solo superadmin, ver routes/index.js): cambia la sesión actual por la de otro usuario y permite volver.
// Todo lo que se haga mientras tanto queda a nombre del otro usuario y se registra en system_events a nombre del
// superadmin real (ver services/impersonationService.js).
//
// Se responde 400 (no 403) a los rechazos: el cliente HTTP manda al inicio de sesión ante un 403.

const MAX_IMPERSONATION_MS = 8 * 60 * 60 * 1000; // una sesión de suplantación dura como máximo 8 horas
const USER_ATTRIBUTES = ['id', 'email', 'usuario', 'nombre', 'time_zone', 'activo'];

// Misma forma que la respuesta del login; `impersonator` solo existe mientras dura la suplantación.
const payload = (user, impersonator = null) => ({
    id: user.id,
    user_name: user.usuario,
    name: user.nombre,
    time_zone: user.time_zone,
    role: user.role?.rol || null,
    ...(impersonator && { impersonator: { id: impersonator.id, name: impersonator.name } }),
});

// `req.login` crea una sesión nueva (protección contra fijación de sesión): se vuelve a fijar la duración de la cookie.
const setCookieMaxAge = (req, maxAge) => {
    if (maxAge == null) {
        req.session.cookie.expires = false;
        req.session.cookie.maxAge = null;
    } else {
        req.session.cookie.maxAge = maxAge;
    }
};

const login = (req, user) => new Promise((resolve, reject) => req.login(user, (err) => (err ? reject(err) : resolve())));

const start = async (req, res) => {
    try {
        if (req.session.impersonator) {
            return res.status(400).json({ message: 'Ya está ingresado como otro usuario. Vuelva primero a su cuenta.' });
        }
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({ message: 'Usuario no válido.' });
        }
        if (id === req.user.id) {
            return res.status(400).json({ message: 'Ya está usando su propia cuenta.' });
        }
        const target = await md.usuarios.scope('withRole').findByPk(id, { attributes: USER_ATTRIBUTES });
        if (!target) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        if (!target.activo) {
            return res.status(400).json({ message: 'No se puede ingresar como un usuario inactivo.' });
        }
        if (target.role?.rol === 'superadmin') {
            return res.status(400).json({ message: 'No se puede ingresar como este usuario.' });
        }

        const impersonator = { id: req.user.id, name: req.user.nombre };
        const originalMaxAge = req.session.cookie.maxAge; // restante de la sesión real (null = hasta cerrar el navegador)
        await login(req, target);
        req.session.impersonator = { ...impersonator, maxAge: originalMaxAge };
        setCookieMaxAge(req, Math.min(originalMaxAge ?? MAX_IMPERSONATION_MS, MAX_IMPERSONATION_MS));

        logStart(req, impersonator, target);
        res.status(200).json(payload(target, impersonator));
    } catch (error) {
        res.status(500).json({ message: `Error al ingresar como otro usuario: ${error.message}` });
    }
};

const exit = async (req, res) => {
    try {
        const impersonator = req.session.impersonator;
        if (!impersonator) {
            return res.status(400).json({ message: 'No está ingresado como otro usuario.' });
        }
        const real = await md.usuarios.scope('withRole').findByPk(impersonator.id, { attributes: USER_ATTRIBUTES });
        if (!real?.activo || real.role?.rol !== 'superadmin') {
            // El superadmin ya no puede serlo (se desactivó o le cambiaron el rol): la sesión se cierra, no se restaura.
            return req.session.destroy(() => {
                res.clearCookie('connect.sid');
                res.status(401).json({ message: 'Su cuenta ya no puede volver a esta sesión. Inicie sesión de nuevo.' });
            });
        }
        const asName = req.user?.nombre;
        await login(req, real);
        setCookieMaxAge(req, impersonator.maxAge);

        logExit(req, { id: impersonator.id, name: impersonator.name }, asName);
        res.status(200).json(payload(real));
    } catch (error) {
        res.status(500).json({ message: `Error al volver a su cuenta: ${error.message}` });
    }
};

module.exports = { start, exit };
