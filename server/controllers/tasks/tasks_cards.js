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
        // set exp_date_year, exp_date_month, exp_date_day, exp_time_hour, exp_time_minute to neext day every time create a card
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        body.exp_date_year = nextDay.getFullYear();
        body.exp_date_month = nextDay.getMonth() + 1;
        body.exp_date_day = nextDay.getDate();
        body.exp_time_hour = 23;
        body.exp_time_minute = 59;
        
        const newCard = await md.tasks_cards.create(body);
        res.status(201).json(newCard);
    } catch (error) {
        console.log(error);
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

        const { list_id, order, responsibles, tags, description, name } = req.body;

        const isCompleted = parseInt(list_id) === 3;

        if(name && name !== card.name){
            await md.tasks_activities.create({
                card_id: id,
                date_activity: new Date(),
                activity_detail: `Se cambió el nombre de '${card.name}' a '${name}'`,
                responsible_id: req.user.id,
            });
        }

        if(description && description !== card.description){
            await md.tasks_activities.create({
                card_id: id,
                date_activity: new Date(),
                activity_detail: `Se cambió la descripción de '${card.description}' a '${description}'`,
                responsible_id: req.user.id,
            });
        }

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

            // Solo se tocan los responsables que realmente cambiaron: destruir todo y
            // recrear reseteaba read_at de gente que no cambió, haciendo reaparecer
            // notificaciones ya leídas cada vez que se tocaba a cualquier otro responsable.
            if (removed.length > 0) {
                await md.tasks_card_responsibles.destroy({
                    where: { card_id: id, responsible_id: removed.map(r => r.id) },
                });
            }
            for (const resp of added) {
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

/**
 * Devuelve las tarjetas de tareas pendientes (no completadas) donde el
 * usuario autenticado figura como responsable Y aún no marcó como leída esa
 * asignación (tasks_card_responsibles.read_at IS NULL), para alimentar la
 * campanita de notificaciones. Ordenadas por vencimiento más próximo primero.
 */
const getAssignedToMe = async (req, res) => {
    try {
        const cards = await md.tasks_cards.findAll({
            where: { completed: false },
            include: [
                {
                    model: md.usuarios,
                    as: 'responsibles',
                    where: { id: req.user.id },
                    required: true,
                    through: { attributes: [], where: { read_at: null } },
                    attributes: [],
                },
                {
                    model: md.reportes,
                    as: 'report',
                    attributes: ['id', 'nombre'],
                    include: [
                        {
                            model: md.campanas,
                            as: 'campana',
                            attributes: ['id', 'nombre'],
                        },
                    ],
                },
            ],
            // Tareas sin fecha de vencimiento (year/month/day = 0) van al final,
            // en vez de primero como saldría de un ORDER BY numérico simple.
            order: [
                [md.sequelize.literal('CASE WHEN "tasks_cards"."exp_date_year" = 0 THEN 1 ELSE 0 END'), 'ASC'],
                ['exp_date_year', 'ASC'],
                ['exp_date_month', 'ASC'],
                ['exp_date_day', 'ASC'],
            ],
        });

        const result = cards.map((card) => {
            if (card.exp_date_year && card.exp_date_month && card.exp_date_day) {
                card.dataValues.expired_status = getExpirationStatus(card);
                card.dataValues.expired_date = new Date(
                    card.exp_date_year, card.exp_date_month - 1, card.exp_date_day,
                    card.exp_time_hour, card.exp_time_minute,
                );
            } else {
                card.dataValues.expired_status = '';
                card.dataValues.expired_date = null;
            }
            return card;
        });

        res.status(200).json(result);
    } catch (error) {
        res.status(500).json({ message: 'Error al obtener las tareas asignadas' });
    }
};

/**
 * Marca como leída (para el usuario autenticado) su asignación como
 * responsable de una tarjeta puntual. No afecta la tarea en sí ni a otros
 * responsables, solo oculta esa notificación para quien la marcó.
 */
const markAssignedAsRead = async (req, res) => {
    try {
        const cardId = req.params.cardId;
        const [updatedCount] = await md.tasks_card_responsibles.update(
            { read_at: new Date() },
            { where: { card_id: cardId, responsible_id: req.user.id } },
        );
        if (updatedCount === 0) {
            return res.status(404).json({ message: 'No se encontró la asignación para este usuario' });
        }
        res.status(200).json({ message: 'Notificación marcada como leída' });
    } catch (error) {
        res.status(500).json({ message: 'Error al marcar la notificación como leída' });
    }
};

/**
 * Marca como leídas todas las asignaciones pendientes del usuario autenticado.
 */
const markAllAssignedAsRead = async (req, res) => {
    try {
        await md.tasks_card_responsibles.update(
            { read_at: new Date() },
            { where: { responsible_id: req.user.id, read_at: null } },
        );
        res.status(200).json({ message: 'Notificaciones marcadas como leídas' });
    } catch (error) {
        res.status(500).json({ message: 'Error al marcar las notificaciones como leídas' });
    }
};

const remove = async (req, res) => {
    try {
        const id = req.params.id;
        const card = await md.tasks_cards.findByPk(id);
        if (!card) {
            return res.status(404).json({ message: 'No se encontró la tarjeta' });
        }
        await card.destroy();
        return res.status(200).json({ message: 'Tarjeta eliminada correctamente' });
    } catch (error) {
        return res.status(500).json({ message: 'Error al eliminar la tarjeta' });
    }
};

module.exports = {
    getById,
    save,
    update,
    remove,
    getAssignedToMe,
    markAssignedAsRead,
    markAllAssignedAsRead,
};