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

/**
 * Middleware de sesión para clientes (empresas), independiente de passport/usuarios.
 * Debe usarse después de que /auth/client/login haya seteado req.session.empresaId.
 * Revalida en cada request que la empresa siga activa: si se desactivó después
 * del login, la sesión existente deja de servir (no solo el login nuevo).
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
            attributes: ['id'],
        });
        if (!empresa) {
            req.session.empresaId = null;
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
                attributes: ['id'],
            });
            if (empresa) {
                return next();
            }
            req.session.empresaId = null;
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
