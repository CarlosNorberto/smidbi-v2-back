const md = require('../../models');
const { Op } = require('sequelize');
const crypto = require('crypto');

// Seguridad mínima para la contraseña de acceso de cliente: no ultra estricta,
// pero ya no libre como estaba. Mín. 8 caracteres, al menos una letra y un número.
const isPasswordSecure = (password) =>
    typeof password === 'string' &&
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password);

const PASSWORD_RULE_MESSAGE = 'La contraseña debe tener al menos 8 caracteres, incluyendo al menos una letra y un número.';

const checkUsuarioDisponible = async (usuario, excludeId = null) => {
    const where = { usuario };
    if (excludeId) where.id = { [Op.ne]: excludeId };
    const existing = await md.empresas.findOne({ where, attributes: ['id'] });
    return !existing;
};

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const empresa = await md.empresas.findOne({
            where: {
                id: id,
                activo: true
            },
            attributes: [
                'id', 'nombre', 'descripcion', 'email', 'usuario', 'time_zone',
                [md.Sequelize.literal(`("empresas"."password" IS NOT NULL AND "empresas"."password" != '')`), 'has_password'],
            ],
        });
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        res.status(200).json(empresa);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la empresa: ${error.message}` });
    }
};

const getAll = async (req, res) => {
    try {
        const { name = null, activo = true } = req.query;
        let where = { activo: activo };
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        const empresas = await md.empresas.findAll({
            where: where,
            attributes: [
                'id', 'nombre', 'descripcion', 'email', 'usuario', 'time_zone',
                [md.Sequelize.literal(`("empresas"."password" IS NOT NULL AND "empresas"."password" != '')`), 'has_password'],
            ],
            order: [['fecha_creacion', 'DESC']],
        });
        res.status(200).json(empresas);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las empresas: ${error.message}` });
    }
};

const getAllByUsers = async (req, res) => {
    try {
        const { user_ids, page = 1, limit = 10, name = null, company_id = null, active = true } = req.query;
        const offset = (page - 1) * limit;
        let where = {
            id_usuario: {
                [md.Sequelize.Op.in]: user_ids.split(',')
            },
            activo: active
        }
        if (company_id) {
            where.id = company_id;
            delete where.activo;
            delete where.id_usuario;
        }
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        const empresas = await md.empresas.scope('withUser').findAndCountAll({
            where: where,
            attributes: [
                'id', 'nombre', 'activo', 'descripcion', 'email', 'usuario', 'time_zone',
                [md.Sequelize.literal(`("empresas"."password" IS NOT NULL AND "empresas"."password" != '')`), 'has_password'],
                // No se devuelve el token en sí en el listado (solo si existe uno):
                // el valor completo solo se entrega una vez, justo al generarlo.
                [md.Sequelize.literal(`("empresas"."access_token" IS NOT NULL)`), 'has_access_token'],
            ],
            limit,
            offset,
            order: [['fecha_creacion', 'DESC']],
        });
        res.status(200).json(empresas);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las empresas: ${error.message}` });
    }
};

const create = async (req, res) => {
    try {
        const { usuario, password } = req.body;

        if (usuario && !password) {
            return res.status(400).json({ message: 'Debe ingresar una contraseña para el acceso de cliente.' });
        }
        if (password && !isPasswordSecure(password)) {
            return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
        }
        if (usuario && !(await checkUsuarioDisponible(usuario))) {
            return res.status(409).json({ message: 'Ese usuario ya está en uso por otra empresa.' });
        }

        req.body.usuario_creacion = req.user.id;
        const newEmpresa = await md.empresas.create(req.body);
        res.status(201).json(newEmpresa);
    } catch (error) {
        res.status(500).json({ message: `Error al crear la empresa: ${error.message}` });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const empresa = await md.empresas.findOne({
            where: {
                id: id,
            },
        });
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }

        const { usuario, password } = req.body;

        if (password !== undefined && password !== '' && !isPasswordSecure(password)) {
            return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
        }
        // si no se manda password nueva, no se toca la que ya existe (no se limpia por accidente)
        if (password === '' || password === undefined) {
            delete req.body.password;
        }

        const finalUsuario = usuario !== undefined ? usuario : empresa.usuario;
        const finalPassword = req.body.password !== undefined ? req.body.password : empresa.password;
        if (finalUsuario && !finalPassword) {
            return res.status(400).json({ message: 'Debe ingresar una contraseña para el acceso de cliente.' });
        }
        if (usuario && usuario !== empresa.usuario && !(await checkUsuarioDisponible(usuario, id))) {
            return res.status(409).json({ message: 'Ese usuario ya está en uso por otra empresa.' });
        }

        const t = await md.sequelize.transaction();
        try {
            const updatedEmpresa = await empresa.update(req.body, { transaction: t });

            // Al desactivar una empresa, se desactivan en cascada sus
            // categorías, las campañas de esas categorías, y los reportes de
            // esas campañas — corta también el acceso del cliente al Panel de
            // Campaña de todas ellas (ver internalOrClientSessionAuth +
            // getDashboardData, que validan esta misma cadena de "activo").
            if (req.body.activo === false) {
                const categorias = await md.categorias.findAll({
                    where: { id_empresa: id },
                    attributes: ['id'],
                    transaction: t,
                });
                const categoriaIds = categorias.map((c) => c.id);

                if (categoriaIds.length > 0) {
                    await md.categorias.update(
                        { activo: false },
                        { where: { id_empresa: id }, transaction: t }
                    );

                    const campanas = await md.campanas.findAll({
                        where: { id_categoria: categoriaIds },
                        attributes: ['id'],
                        transaction: t,
                    });
                    const campanaIds = campanas.map((c) => c.id);

                    if (campanaIds.length > 0) {
                        await md.campanas.update(
                            { activo: false },
                            { where: { id_categoria: categoriaIds }, transaction: t }
                        );
                        await md.reportes.update(
                            { activo: false },
                            { where: { id_campana: campanaIds }, transaction: t }
                        );
                    }
                }
            }

            await t.commit();
            res.status(200).json(updatedEmpresa);
        } catch (error) {
            await t.rollback();
            throw error;
        }
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar la empresa: ${error.message}` });
    }
};

// Link de acceso sin contraseña: genera un token aleatorio (no un id
// codificado ni reutiliza `code`, que ya usa la app vieja para el embed de
// Looker Studio) y lo guarda en `access_token`. Cualquiera con el link puede
// entrar como esa empresa — lo sabe el usuario, lo pidió así. Regenerar
// invalida el link anterior al instante (se sobreescribe el token).
const generateAccessToken = async (req, res) => {
    try {
        const { id } = req.params;
        const empresa = await md.empresas.findByPk(id);
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        const access_token = crypto.randomBytes(32).toString('hex');
        await empresa.update({ access_token });
        res.status(200).json({ access_token });
    } catch (error) {
        res.status(500).json({ message: `Error al generar el link de acceso: ${error.message}` });
    }
};

const revokeAccessToken = async (req, res) => {
    try {
        const { id } = req.params;
        const empresa = await md.empresas.findByPk(id);
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        await empresa.update({ access_token: null });
        res.status(200).json({ message: 'Link de acceso revocado correctamente' });
    } catch (error) {
        res.status(500).json({ message: `Error al revocar el link de acceso: ${error.message}` });
    }
};

module.exports = {
    getById,
    getAll,
    getAllByUsers,
    create,
    update,
    generateAccessToken,
    revokeAccessToken,
};
