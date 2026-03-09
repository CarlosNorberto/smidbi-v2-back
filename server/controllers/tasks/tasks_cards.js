const md = require('../../models');

const getById = async (req, res) => {
    try {
        const id = req.params.id;
        const card = await md.tasks_cards.findByPk(id, {
            include: [
                {
                    model: md.tasks_tags,
                    as: 'tags',
                    through: { attributes: [] },
                },
                {
                    model: md.usuarios,
                    as: 'responsibles',
                    through: { attributes: [] },
                    attributes: ['id', 'nombre', 'email', 'time_zone'],
                },
                {
                    model: md.reportes,
                    as: 'report',
                    attributes: ['nombre', 'fecha_ini', 'fecha_fin', 'presupuesto'],
                    include: [
                        {
                            model: md.campanas,
                            as: 'campana',
                            required: true,
                            attributes: ['id', 'nombre'],
                            include: [
                                {
                                    model: md.categorias,
                                    as: 'categoria',
                                    required: true,
                                    attributes: ['id', 'nombre'],
                                    include: [
                                        {
                                            model: md.empresas,
                                            as: 'empresa',
                                            attributes: ['id', 'nombre']
                                        }
                                    ]
                                }
                            ]
                        },
                        {
                            model: md.plataformas,
                            as: 'plataforma',
                            attributes: ['id', 'code', 'plataforma']
                        },
                        {
                            model: md.objetivos,
                            as: 'objetivo',
                            attributes: ['id', 'objetivo']
                        }
                    ]
                }
            ]
        });
        if (!card) {
            return res.status(404).json({ message: 'No se encontró la tarjeta' });
        }
        res.status(200).json(card);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener la tarjeta' });
    }
};

const save = async (req, res) => {
    try {
        let body = req.body;
        body.user_id = req.user.id;
        const newCard = await md.tasks_cards.create(body);
        res.status(201).json(newCard);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la tarjeta' });
    }
};

const update = async (req, res) => {
    try {
        const id = req.params.id;

        const card = await md.tasks_cards.findByPk(id);
        if (!card) {
            return res.status(404).json({ message: 'No se encontró la tarjeta' });
        }

        const { list_id, order, responsibles, tags } = req.body;

        const isCompleted = parseInt(list_id) === 3;

        const updateData = {
            ...req.body,
            completed: isCompleted,
        };

        await card.update(updateData);

        if (responsibles) {
            // remove all responsibles
            await md.tasks_card_responsibles.destroy({ where: { card_id: id } });
            for (const resp of responsibles) {
                await md.tasks_card_responsibles.create({
                    card_id: id,
                    responsible_id: resp.id,
                });
            }
        }

        if (tags) {
            // remove all tags
            await md.tasks_cards_tags.destroy({ where: { card_id: id } });
            for (const tag of tags) {
                // add new tags
                await md.tasks_cards_tags.create({
                    card_id: id,
                    tag_id: tag.id,
                });
            }
        }

        return res.status(200).json(card);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al actualizar la tarjeta' });
    }
};

module.exports = {
    getById,
    save,
    update,
};