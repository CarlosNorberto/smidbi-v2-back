const md = require('../../models');
const { getObjetivoLogrado, getExpirationStatus } = require('../../helps');

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
                    model: md.tasks_ads,
                    as: 'ads',
                    attributes: ['id', 'card_id', 'material_links', 'platform_links', 'cta_ad', 'seg_segmentations', 'seg_ages', 'seg_cities']
                },
                {
                    model: md.reportes,
                    as: 'report',
                    attributes: ['id', 'nombre', 'fecha_ini', 'fecha_fin', 'presupuesto', 'cp'],
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
                        },
                    ]
                }
            ]
        });
        if (!card) {
            return res.status(404).json({ message: 'No se encontró la tarjeta' });
        }

        const idReporte = card.report?.id;
        const idObjetivo = card.report?.objetivo?.id;
        const objetivoLogrado = await getObjetivoLogrado(idReporte, idObjetivo);
        card.report.dataValues.objetivo_logrado = objetivoLogrado;

        if(card.exp_date_year && card.exp_date_month && card.exp_date_day) {
            const expDate = new Date(card.exp_date_year, card.exp_date_month - 1, card.exp_date_day, card.exp_time_hour, card.exp_time_minute);
            const currentDate = new Date();
            card.dataValues.expired_status = getExpirationStatus(card);
            card.dataValues.expired_date = expDate;
        }else {
            card.dataValues.expired_status = '';
            card.dataValues.expired_date = null;
        }

        res.status(200).json(card);
    }
    catch (error) {
        res.status(500).json({ message: 'Error al obtener la tarjeta', error });
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

        const card = await md.tasks_cards.scope(['withResponsibles', 'withTags', 'withReport']).findByPk(id);
        if (!card) {
            return res.status(404).json({ message: 'No se encontró la tarjeta' });
        }

        const { list_id, order, responsibles, tags } = req.body;

        const isCompleted = parseInt(list_id) === 3;

        const updateData = {
            ...req.body,
            completed: isCompleted,
            date_completed: isCompleted ? new Date() : null,
        };

        if (responsibles) {            
            const prevIds = new Set(card.responsibles.map(r => r.id));
            const newIds = new Set(responsibles.map(r => r.id));
            const added = responsibles.filter(r => !prevIds.has(r.id));
            const removed = card.responsibles.filter(r => !newIds.has(r.id));
            const is_change_responsibles = added.length > 0 || removed.length > 0;
            if (is_change_responsibles) {
                const parts = [];
                if (added.length > 0) parts.push(`Responsable agregado: ${added.map(r => r.nombre).join(', ')}`);
                if (removed.length > 0) parts.push(`Responsable removido: ${removed.map(r => r.nombre).join(', ')}`);

                await md.tasks_activities.create({
                    card_id: id,
                    date_activity: new Date(),
                    activity_detail: parts.join(' | '),
                    responsible_id: req.user.id,
                });
            }

            await md.tasks_card_responsibles.destroy({ where: { card_id: id } });
            for (const resp of responsibles) {
                await md.tasks_card_responsibles.create({
                    card_id: id,
                    responsible_id: resp.id,
                });
            }
        }

        if (tags) {
            const prevIds = new Set(card.tags.map(t => t.id));
            const newIds = new Set(tags.map(t => t.id));
            const added = tags.filter(t => !prevIds.has(t.id));
            const removed = card.tags.filter(t => !newIds.has(t.id));
            const is_change_tags = added.length > 0 || removed.length > 0;
            if (is_change_tags) {
                const addedTags = added.length > 0
                    ? await md.tasks_tags.findAll({ where: { id: added.map(t => t.id) } })
                    : [];

                const parts = [];
                if (added.length > 0) parts.push(`Etiqueta agregada: ${addedTags.map(t => t.name).join(', ')}`);
                if (removed.length > 0) parts.push(`Etiqueta removida: ${removed.map(t => t.name).join(', ')}`);

                await md.tasks_activities.create({
                    card_id: id,
                    date_activity: new Date(),
                    activity_detail: parts.join(' | '),
                    responsible_id: req.user.id,
                });
            }

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

        await card.update(updateData);

        if(card.exp_date_year && card.exp_date_month && card.exp_date_day) {
            const expDate = new Date(card.exp_date_year, card.exp_date_month - 1, card.exp_date_day, card.exp_time_hour, card.exp_time_minute);
            card.dataValues.expired_status = getExpirationStatus(card);
            card.dataValues.expired_date = expDate;
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