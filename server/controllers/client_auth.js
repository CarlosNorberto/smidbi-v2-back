const md = require('../models');

// Login de clientes (empresas). El campo 'password' en empresas se guarda en
// texto plano (así lo maneja también el sistema antiguo, ver login-empresa.js);
// se replica esa misma comparación para no invalidar las contraseñas ya
// existentes de los clientes.
const login = async (req, res) => {
    try {
        const { usuario, password, remember } = req.body;
        if (!usuario || !password) {
            return res.status(400).json({ message: 'Usuario y contraseña son requeridos.' });
        }

        const empresa = await md.empresas.findOne({
            where: { usuario, password, activo: true },
            attributes: ['id', 'nombre', 'usuario', 'email'],
        });

        if (!empresa) {
            return res.status(401).json({ message: 'Usuario o contraseña incorrectos.' });
        }

        req.session.empresaId = empresa.id;
        // Login normal: por si la sesión traía un `accessTokenUsed` de un login
        // por link anterior (mismo navegador, sin logout de por medio) — este
        // login no depende de ningún token, así que no debe seguir atado a uno.
        req.session.accessTokenUsed = null;
        if (remember) {
            req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 días
        } else {
            req.session.cookie.expires = false;
            req.session.cookie.maxAge = null;
        }
        res.status(200).json(empresa);
    } catch (error) {
        res.status(500).json({ message: `Error al iniciar sesión: ${error.message}` });
    }
};

// Login sin usuario/contraseña vía link de acceso (generado desde
// Empresas en el admin). Quien tenga el link entra directo como esa
// empresa — mismo criterio de sesión que el login normal.
const loginByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const empresa = await md.empresas.findOne({
            where: { access_token: token, activo: true },
            attributes: ['id', 'nombre', 'usuario', 'email'],
        });

        if (!empresa) {
            return res.status(404).json({ message: 'Este link no es válido o ya no está disponible.' });
        }

        req.session.empresaId = empresa.id;
        // Se guarda el token usado para este login: así, si luego se revoca o
        // se regenera desde el admin, `clientSessionAuth` puede detectar que
        // YA NO coincide con el vigente y cortar también la sesión abierta
        // (no solo bloquear logins nuevos con el link viejo).
        req.session.accessTokenUsed = token;
        req.session.cookie.maxAge = 30 * 24 * 60 * 60 * 1000; // 30 días, igual que "recordar sesión"
        res.status(200).json(empresa);
    } catch (error) {
        res.status(500).json({ message: `Error al iniciar sesión: ${error.message}` });
    }
};

const logout = (req, res) => {
    req.session.empresaId = null;
    req.session.accessTokenUsed = null;
    res.status(200).json({ message: 'Sesión cerrada correctamente' });
};

const me = async (req, res) => {
    try {
        const empresa = await md.empresas.findByPk(req.session.empresaId, {
            attributes: ['id', 'nombre', 'usuario', 'email'],
        });
        if (!empresa) {
            return res.status(404).json({ message: 'No se encontró la empresa.' });
        }
        res.status(200).json(empresa);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la sesión: ${error.message}` });
    }
};

module.exports = {
    login,
    loginByToken,
    logout,
    me,
};
