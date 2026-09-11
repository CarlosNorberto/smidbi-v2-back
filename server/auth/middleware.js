const moment = require('moment-timezone');

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
 * @param {object} req - Request
 * @param {object} res - Response
 * @param {function} next - Next
 * @returns {void}
 */
const clientSessionAuth = (req, res, next) => {
    if (req.session && req.session.empresaId) {
        return next();
    }
    res.status(403).send({ message: "Acceso denegado. Por favor inicie sesión" });
}

module.exports = {
    sessionAuth,
    requireRole,
    clientSessionAuth,
};
