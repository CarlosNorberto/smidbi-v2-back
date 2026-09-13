const md = require('../../models');

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const categoria = await md.categorias.findOne({
            where: {
                id: id,
            },
            attributes: ['id', 'nombre', 'descripcion', 'activo'],
        });
        if (!categoria) {
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }
        res.status(200).json(categoria);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la categoría: ${error.message}` });
    }
};

const getAllByCompany = async (req, res) => {
    try {        
        const { company_id } = req.params;        
        const { page = 1, limit = 10, name = null } = req.query;
        const offset = (page - 1) * limit;
        let where = {
            id_empresa: company_id,
        }
        if (name){
            where.nombre = {
                [md.Sequelize.Op.iLike]: `%${name}%`
            };
        }
        const categories = await md.categorias.findAndCountAll({
            where: where,
            attributes: ['id', 'nombre', 'descripcion', 'activo'],
            limit,
            offset,
            order: [['fecha_creacion', 'DESC']],
        });

        res.status(200).json(categories);
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const create = async (req, res) => {
    try {
        const { id_empresa, nombre, descripcion } = req.body;
        if (!id_empresa || !nombre) {
            return res.status(400).json({ message: 'id_empresa y nombre son obligatorios.' });
        }
        const categoria = await md.categorias.create({
            id_empresa,
            nombre,
            descripcion,
            activo: true,
            usuario_creacion: req.user.id,
            id_usuario: req.user.id,
        });
        res.status(201).json(categoria);
    } catch (error) {
        res.status(500).json({ message: `Error al crear la categoría: ${error.message}` });
    }
};

const update = async (req, res) => {
    const t = await md.sequelize.transaction();
    try {
        const { id } = req.params;
        const { nombre, descripcion, activo } = req.body;
        const categoria = await md.categorias.findByPk(id, { transaction: t });
        if (!categoria) {
            await t.rollback();
            return res.status(404).json({ message: 'Categoría no encontrada' });
        }
        await categoria.update({
            nombre,
            descripcion,
            activo,
            usuario_modificacion: req.user.id,
            fecha_modificacion: new Date(),
        }, { transaction: t });

        // Al desactivar una categoría, se desactivan en cascada sus campañas
        // y los reportes de esas campañas (corta el acceso del cliente al
        // Panel de Campaña de todas ellas).
        if (activo === false) {
            const campanas = await md.campanas.findAll({
                where: { id_categoria: id },
                attributes: ['id'],
                transaction: t,
            });
            const campanaIds = campanas.map((c) => c.id);

            if (campanaIds.length > 0) {
                await md.campanas.update(
                    { activo: false },
                    { where: { id_categoria: id }, transaction: t }
                );
                await md.reportes.update(
                    { activo: false },
                    { where: { id_campana: campanaIds }, transaction: t }
                );
            }
        }

        await t.commit();
        res.status(200).json(categoria);
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: `Error al actualizar la categoría: ${error.message}` });
    }
};

module.exports = {
    getById,
    getAllByCompany,
    create,
    update,
};
