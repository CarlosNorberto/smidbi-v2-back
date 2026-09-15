const moment = require('moment-timezone');
const md = require('../models');

/**
 * Middleware para autorizar las peticiones de sesión
 * @param {object} req - Request
 * @param {object} res - Response
 * @param {function} next - Next
 * @returns {void}
 */
const sessionAuth = async (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    } else {
        res.status(403).send({ message: "Acceso denegado. Por favor inicie sesión" });
    }
}

/**
 * Middleware para restringir el acceso a un conjunto de roles. Debe usarse
 * después de sessionAuth, ya que depende de req.user.
 * @param {...string} allowedRoles - Roles permitidos (ej: 'superadmin')
 * @returns {function} Middleware de Express
 */
const requireRole = (...allowedRoles) => (req, res, next) => {
    const userRole = req.user?.role?.rol;
    if (userRole && allowedRoles.includes(userRole)) {
        return next();
    }
    res.status(403).send({ message: 'Acceso denegado. No tiene permisos suficientes.' });
}

// Sesiones iniciadas con el link de acceso (`/auth/client/token/:token`)
// guardan qué token usaron (`req.session.accessTokenUsed`, ver
// client_auth.js). Si ese token ya no es el vigente de la empresa —se
// revocó o se generó uno nuevo, que invalida el anterior— la sesión abierta
// queda cortada acá aunque el usuario nunca haya cerrado sesión. Los logins
// normales por usuario/contraseña nunca setean ese campo, así que no los
// afecta esta verificación.
const empresaSesionSigueValida = (empresa, req) => {
    if (!empresa) return false;
    if (req.session.accessTokenUsed && empresa.access_token !== req.session.accessTokenUsed) {
        return false;
    }
    return true;
};

/**
 * Middleware de sesión para clientes (empresas), independiente de passport/usuarios.
 * Debe usarse después de que /auth/client/login haya seteado req.session.empresaId.
 * Revalida en cada request que la empresa siga activa y, si el login fue por
 * link, que ese link siga siendo el vigente — si se desactivó la empresa o se
 * revocó/regeneró el link después del login, la sesión existente deja de
 * servir (no solo el login nuevo).
 * @param {object} req - Request
 * @param {object} res - Response
 * @param {function} next - Next
 * @returns {void}
 */
const clientSessionAuth = async (req, res, next) => {
    if (!req.session || !req.session.empresaId) {
        return res.status(403).send({ message: "Acceso denegado. Por favor inicie sesión" });
    }
    try {
        const empresa = await md.empresas.findOne({
            where: { id: req.session.empresaId, activo: true },
            attributes: ['id', 'access_token'],
        });
        if (!empresaSesionSigueValida(empresa, req)) {
            req.session.empresaId = null;
            req.session.accessTokenUsed = null;
            return res.status(403).send({ message: "Acceso denegado. Por favor inicie sesión" });
        }
        return next();
    } catch (error) {
        res.status(500).send({ message: `Error al validar la sesión: ${error.message}` });
    }
}

/**
 * Middleware para rutas que puede ver tanto un usuario interno logueado
 * (staff, vía passport) como un cliente logueado con su empresa (sesión de
 * cliente). Usado en el dashboard de campaña ("Panel de Campaña"), al que
 * hoy accede el staff y próximamente accederá el cliente final.
 * @param {object} req - Request
 * @param {object} res - Response
 * @param {function} next - Next
 * @returns {void}
 */
const internalOrClientSessionAuth = async (req, res, next) => {
    if (req.isAuthenticated()) {
        return next();
    }
    if (req.session && req.session.empresaId) {
        try {
            const empresa = await md.empresas.findOne({
                where: { id: req.session.empresaId, activo: true },
                attributes: ['id', 'access_token'],
            });
            if (empresaSesionSigueValida(empresa, req)) {
                return next();
            }
            req.session.empresaId = null;
            req.session.accessTokenUsed = null;
        } catch (error) {
            return res.status(500).send({ message: `Error al validar la sesión: ${error.message}` });
        }
    }
    res.status(403).send({ message: "Acceso denegado. Por favor inicie sesión" });
}

module.exports = {
    sessionAuth,
    requireRole,
    clientSessionAuth,
    internalOrClientSessionAuth,
};
