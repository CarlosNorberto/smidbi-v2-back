const md = require('../../models');
const { copyReportWithChildren } = require('./reportes');

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const campana = await md.campanas.findOne({
            where: {
                id: id,
            },
            attributes: ['id', 'nombre', 'descripcion', 'mes', 'gestion', 'moneda', 'activo'],
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
        const { page = 1, limit = 10, details = false, name = null } = req.query;        
        const offset = (page - 1) * limit;
        let where = {
            id_categoria: category_id
        };
        if (name) {
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        let attributes = ['id', 'nombre', 'descripcion', 'mes', 'gestion', 'moneda', 'activo'];
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
                id_usuario: req.user.id,
                activo: true,
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
                { nombre: sourceReport.nombre, id_campana: newCampaign.id },
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
        const { id_categoria, nombre, descripcion, mes, gestion, moneda } = req.body;
        if (!id_categoria || !nombre || !mes || !gestion || !moneda) {
            return res.status(400).json({ message: 'id_categoria, nombre, mes, gestion y moneda son obligatorios.' });
        }
        const campana = await md.campanas.create({
            id_categoria,
            nombre,
            descripcion,
            mes,
            gestion,
            moneda,
            activo: true,
            usuario_creacion: req.user.id,
            id_usuario: req.user.id,
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
        const campana = await md.campanas.findByPk(id, { transaction: t });
        if (!campana) {
            await t.rollback();
            return res.status(404).json({ message: 'Campaña no encontrada' });
        }
        await campana.update({
            nombre,
            descripcion,
            mes,
            gestion,
            moneda,
            activo,
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
    copyCampaignAndReports,
    create,
    update,
};
