const md = require('../models');
const bcrypt = require('bcrypt');

const getAll = async (req, res) => {
    try {
        const { attributes, active } = req.query;
        const usuarioAttributes = ['id', 'nombre', 'email', 'activo'];
        if (attributes) {
            usuarioAttributes.push(...attributes.split(','));
        }
        const where = {};
        if (active !== undefined) {
            where.activo = active === 'true';
        }
        const usuarios = await md.usuarios.scope('withRole').findAll({
            where: where,
            attributes: usuarioAttributes,
            order: [['nombre', 'ASC']],
        });        
        res.status(200).json(usuarios);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los usuarios: ${error.message}` });
    }
}

const saveUpdate = async (req, res) => {
    try {
        let { id, nombre, usuario, email, time_zone, password, activo, role_id } = req.body;
        let usuarioRecord;
        if(!nombre || !usuario || !email) {
            return  res.status(400).json({ message: 'Nombre, usuario y email son campos obligatorios.' });
        }        
        if (id) {            
            usuarioRecord = await md.usuarios.findByPk(id);
        }
        if (password){
            const salt = await bcrypt.genSalt(10);
            password = await bcrypt.hash(password, salt);
        }
        if (!role_id) {
            role_id = 2; // Asignar rol por defecto si no se proporciona
        }
        if (usuarioRecord) {
            let usuario_modificacion = req.user ? req.user.id : null;
            await usuarioRecord.update({ nombre, usuario, email, time_zone, password, activo, usuario_modificacion, role_id });
        } else {
            let usuario_creacion = req.user ? req.user.id : null;
            usuarioRecord = await md.usuarios.create({ nombre, usuario, email, time_zone, password, activo, usuario_creacion, role_id });
        }
        res.status(200).json(usuarioRecord);
    } catch (error) {
        res.status(500).json({ message: `Error al guardar el usuario: ${error.message}` });
    }
}

const changePassword = async (req, res) => {
    try {
        const { id } = req.params;
        const { currentPassword, newPassword } = req.body;
        const usuarioRecord = await md.usuarios.findByPk(id);
        if (!usuarioRecord) {
            return res.status(404).json({ message: 'Usuario no encontrado.' });
        }
        const isMatch = await bcrypt.compare(currentPassword, usuarioRecord.password);
        if (!isMatch) {
            return res.status(400).json({ message: 'La contraseña actual es incorrecta.' });
        }
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);
        await usuarioRecord.update({ password: hashedPassword });
        res.status(200).json({ message: 'Contraseña actualizada correctamente.' });
    } catch (error) {
        res.status(500).json({ message: `Error al cambiar la contraseña: ${error.message}` });
    }
}

module.exports = {
    getAll,
    saveUpdate,
    changePassword,
};