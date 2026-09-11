const md = require('../models');

// Login de clientes (empresas). El campo 'password' en empresas se guarda en
// texto plano (así lo maneja también el sistema antiguo, ver login-empresa.js);
// se replica esa misma comparación para no invalidar las contraseñas ya
// existentes de los clientes.
const login = async (req, res) => {
    try {
        const { usuario, password } = req.body;
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
        res.status(200).json(empresa);
    } catch (error) {
        res.status(500).json({ message: `Error al iniciar sesión: ${error.message}` });
    }
};

const logout = (req, res) => {
    req.session.empresaId = null;
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
    logout,
    me,
};
