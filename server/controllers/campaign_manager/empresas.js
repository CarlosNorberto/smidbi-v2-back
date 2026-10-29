const md = require('../../models');
const { Op } = require('sequelize');
const crypto = require('crypto');
const { isUnrestricted, canManageCompany, denyAccess } = require('../../auth/ownership');

// Campos que el cliente nunca puede fijar por el body: el responsable (dueño)
// se asigna al crear y NO cambia al editar; el token de acceso solo se maneja
// por sus endpoints dedicados.
const PROTECTED_FIELDS = ['id', 'id_usuario', 'usuario_creacion', 'fecha_creacion', 'access_token'];

// Seguridad mínima para la contraseña de acceso de cliente: no ultra estricta,
// pero ya no libre como estaba. Mín. 8 caracteres, al menos una letra y un número.
const isPasswordSecure = (password) =>
    typeof password === 'string' &&
    password.length >= 8 &&
    /[a-zA-Z]/.test(password) &&
    /[0-9]/.test(password);

const PASSWORD_RULE_MESSAGE =
    'La contraseña debe tener al menos 8 caracteres, incluyendo al menos una letra y un número.';

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
                activo: true,
            },
            attributes: [
                'id',
                'nombre',
                'descripcion',
                'email',
                'usuario',
                'time_zone',
                [
                    md.Sequelize.literal(
                        `("empresas"."password" IS NOT NULL AND "empresas"."password" != '')`,
                    ),
                    'has_password',
                ],
            ],
        });
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        res.status(200).json(empresa);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener la empresa: ${error.message}`,
        });
    }
};

const getAll = async (req, res) => {
    try {
        const { name = null, activo = true } = req.query;
        let where = { activo: activo };
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`,
            };
        }
        const empresas = await md.empresas.findAll({
            where: where,
            attributes: [
                'id',
                'nombre',
                'descripcion',
                'email',
                'usuario',
                'time_zone',
                [
                    md.Sequelize.literal(
                        `("empresas"."password" IS NOT NULL AND "empresas"."password" != '')`,
                    ),
                    'has_password',
                ],
            ],
            order: [['fecha_creacion', 'DESC']],
        });
        res.status(200).json(empresas);
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener las empresas: ${error.message}`,
        });
    }
};

const getAllByUsers = async (req, res) => {
    try {
        const {
            user_ids,
            page = 1,
            limit = 10,
            name = null,
            company_id = null,
            active = true,
        } = req.query;
        const offset = (page - 1) * limit;

        // 'user' es un rol restringido: solo puede ver las empresas de las que
        // es responsable. admin/superadmin ven todas por defecto, con opción
        // de filtrar por responsable(s) desde el front. El filtro de rol se
        // decide acá con el usuario de la sesión — nunca se confía en el
        // `user_ids` que mande el cliente para decidir si restringe o no,
        // solo se usa (si viene) para que admin/superadmin acoten la vista.
        const isUnrestricted =
            req.user.role?.rol === 'admin' ||
            req.user.role?.rol === 'superadmin';

        let where = company_id ? { id: company_id } : { activo: active };
        if (!isUnrestricted) {
            where.id_usuario = req.user.id;
        } else if (user_ids && !company_id) {
            // El filtro por responsable solo aplica al listado general. Con una empresa concreta
            // (/admin/companies/:id, p. ej. al elegirla en el buscador general) se ignora: el frontend lo manda
            // con el valor por defecto (el propio admin) y escondía las empresas de otros usuarios.
            where.id_usuario = { [md.Sequelize.Op.in]: user_ids.split(',') };
        }
        if (!company_id && name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`,
            };
        }
        const empresas = await md.empresas.scope('withUser').findAndCountAll({
            where: where,
            attributes: [
                'id',
                'nombre',
                'activo',
                'descripcion',
                'email',
                'usuario',
                'time_zone',
                [
                    md.Sequelize.literal(
                        `("empresas"."password" IS NOT NULL AND "empresas"."password" != '')`,
                    ),
                    'has_password',
                ],
                // El listado no devuelve el token en sí, solo si existe uno: el valor
                // completo se pide aparte (getAccessToken) recién cuando el admin abre
                // el detalle de esa empresa puntual, no en cada fila de la tabla.
                [
                    md.Sequelize.literal(
                        `("empresas"."access_token" IS NOT NULL)`,
                    ),
                    'has_access_token',
                ],
            ],
            limit,
            offset,
            // Desempate por 'id' además de 'fecha_creacion': sin esto, dos
            // empresas con la misma fecha_creacion (hasta el segundo) no
            // tienen un orden garantizado entre una consulta y otra — eso es
            // lo que se veía como parpadeo/reordenamiento en el listado.
            order: [['fecha_creacion', 'DESC'], ['id', 'DESC']],
        });
        res.status(200).json(empresas);
    } catch (error) {
        console.log('COMPANIES BY USER error:', error);
        res.status(500).json({
            message: `Error al obtener las empresas: ${error.message}`,
        });
    }
};

const create = async (req, res) => {
    try {
        const { usuario, password } = req.body;

        if (usuario && !password) {
            return res
                .status(400)
                .json({
                    message:
                        'Debe ingresar una contraseña para el acceso de cliente.',
                });
        }
        if (password && !isPasswordSecure(password)) {
            return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
        }
        if (usuario && !(await checkUsuarioDisponible(usuario))) {
            return res
                .status(409)
                .json({
                    message: 'Ese usuario ya está en uso por otra empresa.',
                });
        }

        // El responsable es quien crea la empresa (antes caía en el default 1 del
        // modelo y la empresa no aparecía en la lista de quien la creó). Solo
        // admin/superadmin pueden asignarla a otro responsable al crearla.
        const requestedOwner = Number(req.body.id_usuario);
        const ownerId = isUnrestricted(req.user) && Number.isInteger(requestedOwner) && requestedOwner > 0
            ? requestedOwner
            : req.user.id;
        PROTECTED_FIELDS.forEach((field) => delete req.body[field]);
        req.body.usuario_creacion = req.user.id;
        req.body.id_usuario = ownerId;
        const newEmpresa = await md.empresas.create(req.body);
        res.status(201).json(newEmpresa);
    } catch (error) {
        res.status(500).json({
            message: `Error al crear la empresa: ${error.message}`,
        });
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
        if (!(await canManageCompany(req.user, empresa.id))) {
            return denyAccess(res);
        }
        // Editar una empresa no cambia su responsable ni sus datos de control.
        PROTECTED_FIELDS.forEach((field) => delete req.body[field]);

        const { usuario, password } = req.body;

        if (
            password !== undefined &&
            password !== '' &&
            !isPasswordSecure(password)
        ) {
            return res.status(400).json({ message: PASSWORD_RULE_MESSAGE });
        }
        // si no se manda password nueva, no se toca la que ya existe (no se limpia por accidente)
        if (password === '' || password === undefined) {
            delete req.body.password;
        }

        const finalUsuario = usuario !== undefined ? usuario : empresa.usuario;
        const finalPassword =
            req.body.password !== undefined
                ? req.body.password
                : empresa.password;
        if (finalUsuario && !finalPassword) {
            return res
                .status(400)
                .json({
                    message:
                        'Debe ingresar una contraseña para el acceso de cliente.',
                });
        }
        if (
            usuario &&
            usuario !== empresa.usuario &&
            !(await checkUsuarioDisponible(usuario, id))
        ) {
            return res
                .status(409)
                .json({
                    message: 'Ese usuario ya está en uso por otra empresa.',
                });
        }

        const t = await md.sequelize.transaction();
        try {
            const updatedEmpresa = await empresa.update(req.body, {
                transaction: t,
            });

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
                        { where: { id_empresa: id }, transaction: t },
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
                            {
                                where: { id_categoria: categoriaIds },
                                transaction: t,
                            },
                        );
                        await md.reportes.update(
                            { activo: false },
                            {
                                where: { id_campana: campanaIds },
                                transaction: t,
                            },
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
        res.status(500).json({
            message: `Error al actualizar la empresa: ${error.message}`,
        });
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
        res.status(500).json({
            message: `Error al generar el link de acceso: ${error.message}`,
        });
    }
};

// El token queda guardado en texto plano en `access_token` (se compara tal
// cual en el login por link), así que no hay problema en devolverlo de
// nuevo para esta misma empresa — evita forzar una regeneración solo para
// volver a ver un link que ya se había generado antes.
const getAccessToken = async (req, res) => {
    try {
        const { id } = req.params;
        const empresa = await md.empresas.findByPk(id, {
            attributes: ['id', 'access_token'],
        });
        if (!empresa) {
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }
        res.status(200).json({ access_token: empresa.access_token });
    } catch (error) {
        res.status(500).json({
            message: `Error al obtener el link de acceso: ${error.message}`,
        });
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
        res.status(200).json({
            message: 'Link de acceso revocado correctamente',
        });
    } catch (error) {
        res.status(500).json({
            message: `Error al revocar el link de acceso: ${error.message}`,
        });
    }
};

// Asigna la empresa a otro responsable y, en cascada, todas sus categorías,
// campañas y reportes (que siempre deben tener el mismo responsable que su empresa).
// Solo admin/superadmin (ver la ruta). Es la ÚNICA forma de cambiar el responsable
// de una empresa existente: editarla no lo cambia. No toca las tareas ni sus
// responsables (tasks_card_responsibles).
const assignOwner = async (req, res) => {
    const t = await md.sequelize.transaction();
    try {
        const { id } = req.params;
        const newOwnerId = Number(req.body.id_usuario);
        if (!Number.isInteger(newOwnerId) || newOwnerId <= 0) {
            await t.rollback();
            return res.status(400).json({ message: 'Debe indicar el usuario al que se asignará la empresa.' });
        }

        const empresa = await md.empresas.findByPk(id, { transaction: t });
        if (!empresa) {
            await t.rollback();
            return res.status(404).json({ message: 'Empresa no encontrada' });
        }

        const usuario = await md.usuarios.findOne({
            where: { id: newOwnerId },
            include: [{ model: md.roles, as: 'role' }],
            transaction: t,
        });
        if (!usuario || usuario.activo === false) {
            await t.rollback();
            return res.status(400).json({ message: 'El usuario seleccionado no existe o está inactivo.' });
        }
        if (usuario.role?.rol === 'hidden') {
            await t.rollback();
            return res.status(400).json({ message: 'No se puede asignar una empresa a un usuario con rol oculto.' });
        }

        const previousOwnerId = empresa.id_usuario;
        await empresa.update(
            { id_usuario: newOwnerId, usuario_modificacion: req.user.id, fecha_modificacion: new Date() },
            { transaction: t },
        );

        let categorias = 0;
        let campanas = 0;
        let reportes = 0;
        const categoriaIds = (await md.categorias.findAll({ where: { id_empresa: id }, attributes: ['id'], transaction: t })).map((c) => c.id);
        if (categoriaIds.length > 0) {
            [categorias] = await md.categorias.update({ id_usuario: newOwnerId }, { where: { id_empresa: id }, transaction: t });
            const campanaIds = (await md.campanas.findAll({ where: { id_categoria: categoriaIds }, attributes: ['id'], transaction: t })).map((c) => c.id);
            if (campanaIds.length > 0) {
                [campanas] = await md.campanas.update({ id_usuario: newOwnerId }, { where: { id_categoria: categoriaIds }, transaction: t });
                [reportes] = await md.reportes.update({ id_usuario: newOwnerId }, { where: { id_campana: campanaIds }, transaction: t });
            }
        }

        await t.commit();
        res.status(200).json({
            message: 'Empresa asignada correctamente',
            previous_owner_id: previousOwnerId,
            owner: { id: usuario.id, nombre: usuario.nombre },
            affected: { empresas: 1, categorias, campanas, reportes },
        });
    } catch (error) {
        if (!t.finished) await t.rollback();
        res.status(500).json({ message: `Error al asignar la empresa: ${error.message}` });
    }
};

module.exports = {
    getById,
    getAll,
    getAllByUsers,
    create,
    update,
    generateAccessToken,
    getAccessToken,
    revokeAccessToken,
    assignOwner,
};
