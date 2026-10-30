const md = require('../models');
const bcrypt = require('bcrypt');
const { Op } = require('sequelize');
const Sequelize = require('sequelize');

const getAll = async (req, res) => {
    try {
        const { attributes, active, include_hidden } = req.query;
        const usuarioAttributes = ['id', 'nombre', 'email', 'activo'];
        if (attributes) {
            usuarioAttributes.push(...attributes.split(','));
        }
        const where = {};
        if (active !== undefined) {
            where.activo = active === 'true';
        }
        let usuarios = await md.usuarios.scope('withRole').findAll({
            where: where,
            attributes: usuarioAttributes,
            order: [['nombre', 'ASC']],
        });

        // El rol 'hidden' nunca aparece salvo que quien pida la lista sea
        // superadmin Y pida explícitamente verlo (`include_hidden=true`) —
        // así la tabla de administración de usuarios lo puede mostrar, pero
        // ningún dropdown de "seleccionar usuario" (responsable, reviewer,
        // etc.) lo ofrece nunca, sin importar el rol de quien esté mirando.
        const puedeVerOcultos = include_hidden === 'true' && req.user.role?.rol === 'superadmin';
        if (!puedeVerOcultos) {
            usuarios = usuarios.filter((u) => u.role?.rol !== 'hidden');
        }

        res.status(200).json(usuarios);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener los usuarios: ${error.message}` });
    }
}

const saveUpdate = async (req, res) => {
    try {
        let { id, nombre, usuario, email, time_zone, password, activo, role_id, phone } = req.body;
        let usuarioRecord;
        // Espacios al inicio/fin del nombre de usuario harían que el login no lo encuentre.
        nombre = typeof nombre === 'string' ? nombre.trim() : nombre;
        usuario = typeof usuario === 'string' ? usuario.trim() : usuario;
        email = typeof email === 'string' ? email.trim() : email;
        if(!nombre || !usuario || !email) {
            return  res.status(400).json({ message: 'Nombre, usuario y email son campos obligatorios.' });
        }
        if (id) {
            usuarioRecord = await md.usuarios.findByPk(id);
        }
        // Nombre de usuario nuevo (o cambiado): solo letras minúsculas. Los usuarios antiguos con mayúsculas
        // se pueden seguir guardando mientras no les cambien el nombre de usuario.
        if ((!usuarioRecord || usuarioRecord.usuario !== usuario) && !/^[a-z]+$/.test(usuario)) {
            return res.status(400).json({ message: 'El nombre de usuario solo puede contener letras minúsculas, sin espacios ni números.' });
        }
        // El nombre de usuario debe ser único entre los usuarios ACTIVOS (sin distinguir mayúsculas): con dos iguales
        // el login no sabría a cuál corresponde la contraseña. Un usuario inactivo no bloquea el nombre.
        const willBeActive = activo === undefined || activo === null ? (usuarioRecord ? usuarioRecord.activo : true) : activo !== false && activo !== 'false';
        if (willBeActive) {
            const duplicated = await md.usuarios.findOne({
                where: {
                    [Op.and]: [
                        Sequelize.where(Sequelize.fn('lower', Sequelize.col('usuario')), usuario.toLowerCase()),
                        { activo: true },
                        ...(usuarioRecord ? [{ id: { [Op.ne]: usuarioRecord.id } }] : []),
                    ],
                },
                attributes: ['id'],
            });
            if (duplicated) {
                return res.status(409).json({ message: `Ya existe un usuario activo con el nombre de usuario "${usuario}". Elija otro.` });
            }
        }
        // El rol "oculto" (para pruebas) solo lo puede asignar, o modificar, un superadmin.
        const requesterIsSuperAdmin = req.user?.role?.rol === 'superadmin';
        if (!requesterIsSuperAdmin) {
            const hiddenRole = await md.roles.findOne({ where: { rol: 'hidden' }, attributes: ['id'], raw: true });
            if (hiddenRole && (Number(role_id) === hiddenRole.id || (usuarioRecord && usuarioRecord.role_id === hiddenRole.id))) {
                return res.status(400).json({ message: 'No tiene permisos para asignar o modificar ese rol.' });
            }
        }
        if (password){
            const salt = await bcrypt.genSalt(10);
            password = await bcrypt.hash(password, salt);
        }
        if (!role_id) {
            role_id = 2; // Asignar rol por defecto si no se proporciona
        }
        // Teléfono (WhatsApp) para los avisos de tareas: se guarda como "+<código país><número>" o vacío.
        if (phone !== undefined) {
            const digits = String(phone ?? '').replace(/\D/g, '').replace(/^00/, '');
            if (digits && !/^\d{8,15}$/.test(digits)) {
                return res.status(400).json({ message: 'El teléfono no es válido: use el número con código de país (ej. +591 ...).' });
            }
            phone = digits ? `+${/^[67]\d{7}$/.test(digits) ? `591${digits}` : digits}` : null;
        }
        if (usuarioRecord) {
            let usuario_modificacion = req.user ? req.user.id : null;
            await usuarioRecord.update({ nombre, usuario, email, time_zone, password, activo, usuario_modificacion, role_id, ...(phone !== undefined && { phone }) });
        } else {
            let usuario_creacion = req.user ? req.user.id : null;
            usuarioRecord = await md.usuarios.create({ nombre, usuario, email, time_zone, password, activo, usuario_creacion, role_id, phone });
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