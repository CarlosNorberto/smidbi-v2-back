const md = require('../../models');
const { copyReportWithChildren } = require('./reportes');
const { canManageCategory, canManageCampaign, getCategoryOwnerId, getCampaignOwnerId, denyAccess } = require('../../auth/ownership');

// Datos del "Funnel de Conversión" del Panel de Campaña (se cargan a mano en la campaña): sesiones y conversiones son
// conteos enteros >= 0 y las etiquetas son los nombres que ve el cliente ("Aperturas de chat", "Inicio de Chat"...).
const FUNNEL_LABEL_DEFAULTS = { etiqueta_sesiones: 'Sesiones', etiqueta_conversiones: 'Conversiones' };
const FUNNEL_FIELD_NAMES = {
    sesiones: 'Las sesiones',
    conversiones: 'Las conversiones',
    etiqueta_sesiones: 'La etiqueta de sesiones',
    etiqueta_conversiones: 'La etiqueta de conversiones',
};

// Devuelve { values } con solo los campos del funnel que vinieron en el body, ya validados y limpios, o { error } si
// alguno no vale. Lo que no viene no se toca: un guardado que no los envía no los pisa.
const pickFunnelFields = (body) => {
    const values = {};
    for (const field of ['sesiones', 'conversiones']) {
        if (body[field] === undefined) continue;
        const number = body[field] === null || body[field] === '' ? 0 : Number(body[field]);
        if (!Number.isSafeInteger(number) || number < 0) {
            return { error: `${FUNNEL_FIELD_NAMES[field]} deben ser un número entero igual o mayor a cero.` };
        }
        values[field] = number;
    }
    for (const field of ['etiqueta_sesiones', 'etiqueta_conversiones']) {
        if (body[field] === undefined) continue;
        const text = String(body[field] ?? '').trim();
        if (text.length > 100) return { error: `${FUNNEL_FIELD_NAMES[field]} no puede pasar de 100 caracteres.` };
        values[field] = text || FUNNEL_LABEL_DEFAULTS[field];
    }
    return { values };
};

// Cargar o cambiar esas cifras es exclusivo de un superadmin (el resto de roles ni ve la sección). Se responde 400 y no 403:
// el cliente HTTP del frontend manda al login ante un 403. En el mensaje se dice "administrador" (nunca "superadmin").
const FUNNEL_FIELDS_FORBIDDEN = { message: 'Las sesiones y conversiones de la campaña solo las puede cambiar un administrador.' };
const canEditFunnelFields = (user) => user?.role?.rol === 'superadmin';

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const campana = await md.campanas.findOne({
            where: {
                id: id,
            },
            attributes: ['id', 'nombre', 'descripcion', 'mes', 'gestion', 'moneda', 'activo', 'sesiones', 'conversiones', 'etiqueta_sesiones', 'etiqueta_conversiones'],
        });
        if (!campana) {
            return res.status(404).json({ message: 'Campaña no encontrada' });
        }
        res.status(200).json(campana);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la campaña: ${error.message}` });
    }
};

const getByCategory = async (req, res) => {
    try {        
        const { category_id } = req.params;
        const { page = 1, limit = 10, details = false, name = null, mes = null, gestion = null, moneda = null } = req.query;        
        const offset = (page - 1) * limit;
        let where = {
            id_categoria: category_id
        };
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        // Filtros opcionales por mes, gestión (año) y moneda.
        if (mes) {
            // Sin distinguir mayúsculas: hay datos antiguos en ambas formas.
            where.mes = { [md.Sequelize.Op.iLike]: String(mes).trim() };
        }
        if (gestion) {
            const year = Number.parseInt(gestion, 10);
            if (!Number.isInteger(year) || year < 2000 || year > 2100) {
                return res.status(400).json({ message: 'La gestión no es válida.' });
            }
            where.gestion = year;
        }
        if (moneda) {
            // La moneda es texto libre en los datos ('$us', '$us.', 'Bs.'...): igual que el selector del formulario, todo lo que
            // empieza con "bs" es bolivianos y el resto dólares.
            where.moneda = /^bs/i.test(String(moneda).trim())
                ? { [md.Sequelize.Op.iLike]: 'bs%' }
                : { [md.Sequelize.Op.or]: [{ [md.Sequelize.Op.notILike]: 'bs%' }, { [md.Sequelize.Op.is]: null }] };
        }
        let attributes = ['id', 'nombre', 'descripcion', 'mes', 'gestion', 'moneda', 'activo', 'sesiones', 'conversiones', 'etiqueta_sesiones', 'etiqueta_conversiones'];
        if (details === 'true') {
            attributes = { exclude: ['usuario_creacion', 'usuario_modificacion', 'usuario_eliminacion'] };
        }
        const campanas = await md.campanas.findAndCountAll({
            where,
            limit,
            offset,
            attributes,
            order: [['fecha_creacion', 'DESC']],
        });
        res.status(200).json(campanas);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

// Menú del cliente ("Sus campañas"): todas las campañas activas de la empresa
// logueada (vía sesión de cliente), con su categoría. El año/mes se agrupa en
// el frontend a partir de `mes`/`gestion` (mismos campos que ya usa el admin al
// crear/editar una campaña, no hace falta parsear el nombre de la categoría).
const getAllForClientMenu = async (req, res) => {
    try {
        const empresaId = req.session.empresaId;
        const campanas = await md.campanas.findAll({
            where: { activo: true },
            attributes: ['id', 'nombre', 'mes', 'gestion'],
            include: [{
                model: md.categorias,
                as: 'categoria',
                attributes: ['id', 'nombre'],
                where: { id_empresa: empresaId, activo: true },
                required: true,
            }],
            order: [['gestion', 'DESC'], ['fecha_creacion', 'DESC']],
        });
        res.status(200).json(campanas);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las campañas: ${error.message}` });
    }
};

// *********************************************//
// **** COPIAR CAMPAÑA (y todos sus reportes) ***//
// *********************************************//

// Campos que nunca se arrastran a la copia: metadatos de la fila original.
const CAMPAIGN_COPY_OMIT_FIELDS = [
    'id',
    'fecha_creacion',
    'fecha_modificacion',
    'fecha_eliminacion',
    'usuario_modificacion',
    'usuario_eliminacion',
];

const copyCampaignAndReports = async (req, res) => {
    const transaction = await md.sequelize.transaction();
    try {
        const { id, nombre, descripcion, mes, gestion, moneda } = req.body;
        if (!id || !nombre) {
            await transaction.rollback();
            return res.status(400).json({ message: 'Debe indicar la campaña de origen y un nombre.' });
        }

        const sourceCampaign = await md.campanas.findOne({
            where: { id },
            include: [{ model: md.reportes, as: 'reportes', required: false }],
            transaction,
        });
        if (!sourceCampaign) {
            await transaction.rollback();
            return res.status(404).json({ message: 'No se encontró la campaña a copiar' });
        }
        if (!(await canManageCampaign(req.user, sourceCampaign.id))) {
            await transaction.rollback();
            return denyAccess(res);
        }

        // La copia (y sus reportes) quedan a nombre del responsable de la empresa,
        // no de quien copia.
        const ownerId = (await getCampaignOwnerId(sourceCampaign.id)) ?? req.user.id;
        const data = sourceCampaign.toJSON();
        const sourceReports = data.reportes || [];
        CAMPAIGN_COPY_OMIT_FIELDS.forEach((field) => delete data[field]);
        delete data.reportes;

        const newCampaign = await md.campanas.create(
            {
                ...data,
                nombre,
                descripcion,
                mes,
                gestion,
                moneda,
                usuario_creacion: req.user.id,
                id_usuario: ownerId,
                // Nace inactiva: la copia trae reportes sin fechas ni valores, y el cliente no debe verla hasta que se active.
                activo: false,
                copy_from: sourceCampaign.id,
            },
            { transaction },
        );

        // Copiar todos los reportes (y su configuración) hacia la nueva
        // campaña. Igual que en el sistema antiguo, no se copian las fechas
        // ni los valores día a día: quedan pendientes de definir en la copia.
        for (const sourceReport of sourceReports) {
            await copyReportWithChildren(
                sourceReport,
                { nombre: sourceReport.nombre, id_campana: newCampaign.id, id_usuario: ownerId },
                req.user.id,
                transaction,
            );
        }

        await transaction.commit();
        res.status(200).json({ message: 'Campaña copiada correctamente', data: newCampaign });
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({ message: `Error al copiar la campaña: ${error.message}` });
    }
};

const create = async (req, res) => {
    try {
        const { id_categoria, nombre, descripcion, mes, gestion, moneda, activo } = req.body;
        if (!id_categoria || !nombre || !mes || !gestion || !moneda) {
            return res.status(400).json({ message: 'id_categoria, nombre, mes, gestion y moneda son obligatorios.' });
        }
        if (!(await canManageCategory(req.user, id_categoria))) {
            return denyAccess(res);
        }
        const funnel = pickFunnelFields(req.body);
        if (funnel.error) return res.status(400).json({ message: funnel.error });
        if (Object.keys(funnel.values).length > 0 && !canEditFunnelFields(req.user)) {
            return res.status(400).json(FUNNEL_FIELDS_FORBIDDEN);
        }
        const campana = await md.campanas.create({
            id_categoria,
            nombre,
            descripcion,
            mes,
            gestion,
            moneda,
            ...funnel.values,
            // Nace INACTIVA salvo que quien la crea la active a propósito: el cliente solo ve campañas activas (menú y Panel de
            // Campaña), así no ve una campaña vacía o a medio armar. Se activa desde la edición cuando esté lista.
            activo: activo === true,
            usuario_creacion: req.user.id,
            // Hereda el responsable de la empresa (no el de quien la crea).
            id_usuario: (await getCategoryOwnerId(id_categoria)) ?? req.user.id,
        });
        res.status(201).json(campana);
    } catch (error) {
        res.status(500).json({ message: `Error al crear la campaña: ${error.message}` });
    }
};

const update = async (req, res) => {
    const t = await md.sequelize.transaction();
    try {
        const { id } = req.params;
        const { nombre, descripcion, mes, gestion, moneda, activo } = req.body;
        const funnel = pickFunnelFields(req.body);
        if (funnel.error) {
            await t.rollback();
            return res.status(400).json({ message: funnel.error });
        }
        if (Object.keys(funnel.values).length > 0 && !canEditFunnelFields(req.user)) {
            await t.rollback();
            return res.status(400).json(FUNNEL_FIELDS_FORBIDDEN);
        }
        const campana = await md.campanas.findByPk(id, { transaction: t });
        if (!campana) {
            await t.rollback();
            return res.status(404).json({ message: 'Campaña no encontrada' });
        }
        if (!(await canManageCampaign(req.user, campana.id))) {
            await t.rollback();
            return denyAccess(res);
        }
        // Ver nota en categorias.update: no se reactiva bajo un padre inactivo y
        // reactivar no devuelve a activo los reportes de la campaña.
        if (activo === true && campana.activo === false) {
            const categoria = await md.categorias.findByPk(campana.id_categoria, { attributes: ['activo'], transaction: t });
            if (categoria && categoria.activo === false) {
                await t.rollback();
                return res.status(409).json({ message: 'No se puede reactivar la campaña porque su categoría está inactiva. Reactive primero la categoría.' });
            }
        }
        await campana.update({
            nombre,
            descripcion,
            mes,
            gestion,
            moneda,
            activo,
            ...funnel.values,
            usuario_modificacion: req.user.id,
            fecha_modificacion: new Date(),
        }, { transaction: t });

        // Al desactivar una campaña, se desactivan en cascada sus reportes
        // (corta el acceso del cliente al Panel de Campaña de esta campaña).
        if (activo === false) {
            await md.reportes.update(
                { activo: false },
                { where: { id_campana: id }, transaction: t }
            );
        }

        await t.commit();
        res.status(200).json(campana);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: `Error al actualizar la campaña: ${error.message}` });
    }
};

module.exports = {
    getById,
    getByCategory,
    getAllForClientMenu,
    copyCampaignAndReports,
    create,
    update,
};
