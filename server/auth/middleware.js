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

module.exports = {
    sessionAuth,
};
