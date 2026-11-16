const md = require('../../models');
const { getObjetivoLogrado, getExpirationStatus } = require('../../helps');
const { notifyUsuarios } = require('../../services/whatsappNotificationService');

// Listas del tablero (tasks_lists): 1 Pendientes, 2 En Proceso, 3 Terminado.
const LIST_NAMES = { 1: 'Pendientes', 2: 'En Proceso', 3: 'Terminado' };

// ---- Reglas de edición --------------------------------------------------------------------------------------------------
// Editar (título, descripción, vencimiento, responsables, etiquetas, pieza de campaña) y eliminar una tarea es de quien la creó,
// de un administrador, o de cualquiera si la tarea no tiene creador (las antiguas). Moverla de columna es de todos los que la ven.
// La pantalla ya lo respeta; el servidor ahora también (antes cualquiera con acceso podía editar o borrar llamando a la API).
// Se responde 400 y no 403: el cliente HTTP del frontend manda al login ante cualquier 403.
const NAME_MAX = 200; // largo de la columna `name`
const isAdminUser = (user) => ['admin', 'superadmin'].includes(user?.role?.rol);
const canEditCard = (user, card) => !card.user_id || card.user_id === user.id || isAdminUser(user);
const EDIT_DENIED = { message: 'Solo quien creó la tarea o un administrador puede editarla. Cualquiera con acceso puede moverla de columna.' };
const DELETE_DENIED = { message: 'Solo quien creó la tarea o un administrador puede eliminarla.' };

// Lista sin repetidos de { id } con ids enteros; null si no es un arreglo válido.
const uniqueById = (items) => {
    if (!Array.isArray(items)) return null;
    const seen = new Map();
    for (const item of items) {
        const id = Number(item?.id);
        if (!Number.isInteger(id) || id <= 0) return null;
        if (!seen.has(id)) seen.set(id, { ...item, id });
    }
    return [...seen.values()];
};
const sameIds = (a, b) => a.length === b.length && a.every((x) => b.includes(x));

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
                    attributes: ['id', 'card_id', 'material_links', 'platform_links', 'cta_ad', 'template', 'seg_segmentations', 'seg_ages', 'seg_cities']
                },
                {
                    model: md.reportes,
                    as: 'report',
                    attributes: ['id', 'nombre', 'fecha_ini', 'fecha_fin', 'presupuesto', 'cp', 'objetivo_proyectado'],
                    include: [
                        {
                            model: md.campanas,
                            as: 'campana',
                            required: true,
                            attributes: ['id', 'nombre', 'moneda'],
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
        // Solo se toman los datos que corresponden a una tarea nueva: antes se guardaba el cuerpo completo y se podía fijar a
        // mano el id, el creador, el inicio, etc.
        const name = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        if (!name) return res.status(400).json({ message: 'El nombre de la tarea es obligatorio.' });
        if (name.length > NAME_MAX) return res.status(400).json({ message: `El nombre de la tarea no puede pasar de ${NAME_MAX} caracteres.` });
        const listId = req.body.list_id === undefined || req.body.list_id === null ? 1 : parseInt(req.body.list_id, 10);
        if (!Number.isInteger(listId) || !(await md.tasks_lists.findByPk(listId))) {
            return res.status(400).json({ message: 'La columna indicada no existe.' });
        }
        if (!req.body.report_id || !(await md.reportes.findByPk(req.body.report_id, { attributes: ['id'] }))) {
            return res.status(400).json({ message: 'El reporte indicado no existe.' });
        }
        const order = Number(req.body.order);
        const description = typeof req.body.description === 'string' && req.body.description.trim() ? req.body.description : null;
        const completed = listId === 3;
        let body = {
            name,
            description,
            report_id: req.body.report_id,
            list_id: listId,
            order: Number.isFinite(order) ? order : null,
            completed,
            date_completed: completed ? new Date() : null,
        };
        body.user_id = req.user.id;
        // set exp_date_year, exp_date_month, exp_date_day, exp_time_hour, exp_time_minute to neext day every time create a card
        const nextDay = new Date();
        nextDay.setDate(nextDay.getDate() + 1);
        body.exp_date_year = nextDay.getFullYear();
        body.exp_date_month = nextDay.getMonth() + 1;
        body.exp_date_day = nextDay.getDate();
        body.exp_time_hour = 23;
        body.exp_time_minute = 59;
        
        body.created_at = new Date();

        const newCard = await md.tasks_cards.create(body);
        await md.tasks_activities.create({
            card_id: newCard.id,
            date_activity: new Date(),
            activity_detail: `Creó la tarjeta ${newCard.name ?? ''}`.trim(),
            responsible_id: req.user.id,
        });
        // La respuesta trae lo mismo que el tablero (estado de vencimiento, fecha, responsables y etiquetas vacíos), para que la
        // tarjeta nueva se vea completa desde el inicio y no solo después de abrirla (antes faltaba "Vigente").
        const card = newCard.toJSON();
        card.expired_status = getExpirationStatus(newCard);
        card.expired_date = new Date(newCard.exp_date_year, newCard.exp_date_month - 1, newCard.exp_date_day, newCard.exp_time_hour, newCard.exp_time_minute);
        card.responsibles = [];
        card.tags = [];
        res.status(201).json(card);
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

        let { list_id, order, responsibles, tags, description, name } = req.body;

        // ---- Validación ANTES de escribir nada: antes un dato inválido (responsable o etiqueta inexistente, columna que no existe)
        // daba 500 cuando ya se habían guardado cambios a medias (historial, responsables quitados...).
        const isOwner = canEditCard(req.user, card);
        if (name !== undefined) {
            name = typeof name === 'string' ? name.trim() : '';
            if (!name) return res.status(400).json({ message: 'El nombre de la tarea no puede quedar vacío.' });
            if (name.length > NAME_MAX) return res.status(400).json({ message: `El nombre de la tarea no puede pasar de ${NAME_MAX} caracteres.` });
        }
        if (list_id !== undefined && list_id !== null) {
            const listNumber = parseInt(list_id, 10);
            if (!Number.isInteger(listNumber) || !(await md.tasks_lists.findByPk(listNumber))) {
                return res.status(400).json({ message: 'La columna indicada no existe.' });
            }
        }
        if (responsibles !== undefined) {
            responsibles = uniqueById(responsibles);
            if (!responsibles) return res.status(400).json({ message: 'La lista de responsables no es válida.' });
            const found = await md.usuarios.count({ where: { id: responsibles.map((r) => r.id) } });
            if (found !== responsibles.length) return res.status(400).json({ message: 'Alguno de los responsables ya no existe.' });
        }
        if (tags !== undefined) {
            tags = uniqueById(tags);
            if (!tags) return res.status(400).json({ message: 'La lista de etiquetas no es válida.' });
            const found = await md.tasks_tags.count({ where: { id: tags.map((t) => t.id) } });
            if (found !== tags.length) return res.status(400).json({ message: 'Alguna de las etiquetas ya no existe.' });
        }
        // Quien no creó la tarea solo puede moverla de columna: si intenta cambiar otra cosa, se le explica (la pantalla le
        // reenvía la tarea completa, así que solo cuenta lo que realmente cambia).
        if (!isOwner) {
            const EXP_FIELDS = ['exp_date_year', 'exp_date_month', 'exp_date_day', 'exp_time_hour', 'exp_time_minute'];
            const changed =
                (name !== undefined && name !== card.name)
                || (description !== undefined && (description || null) !== (card.description || null))
                || EXP_FIELDS.some((f) => req.body[f] !== undefined && Number(req.body[f]) !== Number(card[f]))
                || (responsibles !== undefined && !sameIds(responsibles.map((r) => r.id), card.responsibles.map((r) => r.id)))
                || (tags !== undefined && !sameIds(tags.map((t) => t.id), card.tags.map((t) => t.id)));
            if (changed) return res.status(400).json(EDIT_DENIED);
        }

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

        // Solo se actualizan los datos propios de la tarea. Antes se guardaba el cuerpo completo: se podía cambiar el reporte
        // (mover la tarea a un reporte ajeno), quién la creó o el id. Los tiempos (inicio, término, último aviso) los fija el
        // servidor; `completed` y `date_completed` salen de la columna a la que pasa.
        const updateData = {};
        const EDITABLE = ['description', 'exp_date_year', 'exp_date_month', 'exp_date_day', 'exp_time_hour', 'exp_time_minute'];
        // Quien no creó la tarea solo mueve de columna y reordena; el resto lo cambia únicamente el creador o un administrador.
        if (isOwner) {
            for (const field of EDITABLE) if (req.body[field] !== undefined) updateData[field] = req.body[field];
            if (name !== undefined) updateData.name = name;
        }
        if (req.body.order !== undefined && Number.isFinite(Number(req.body.order))) updateData.order = Number(req.body.order);
        if (list_id !== undefined && list_id !== null) updateData.list_id = parseInt(list_id, 10);

        // "Terminado" y su fecha solo cambian cuando la tarea cambia de columna: editar una tarea que ya está terminada
        // (título, responsables, etc.) no debe mover su fecha de término.
        const listChanged = list_id !== undefined && parseInt(list_id) !== card.list_id;
        if (listChanged) {
            updateData.completed = isCompleted;
            updateData.date_completed = isCompleted ? new Date() : null;
        }

        // Al cambiar de columna se deja constancia (misma frase que la app anterior) y, la primera vez que la tarea
        // pasa a "En Proceso", se marca el inicio (fin del tiempo de respuesta).
        if (listChanged) {
            const toList = parseInt(list_id);
            // Si pasa directo a "Terminado" sin haber pasado por "En Proceso", el inicio es el momento de terminarla.
            if ((toList === 2 || toList === 3) && !card.started_at) updateData.started_at = new Date();
            if (LIST_NAMES[toList]) {
                await md.tasks_activities.create({
                    card_id: id,
                    date_activity: new Date(),
                    activity_detail: `Movió la tarjeta a ${LIST_NAMES[toList]}`,
                    responsible_id: req.user.id,
                });
            }
        }

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

        // La tarea se cargó ANTES de cambiar responsables y etiquetas: la respuesta debe traer las listas ya actualizadas (la
        // pantalla las toma de aquí). Antes llegaban "de casualidad" porque se guardaba el cuerpo completo del pedido.
        if (responsibles !== undefined || tags !== undefined) {
            const fresh = await md.tasks_cards.scope(['withResponsibles', 'withTags']).findByPk(id);
            card.dataValues.responsibles = fresh.responsibles;
            card.dataValues.tags = fresh.tags;
        }
        // Igual que al abrir la tarea (getById): la pantalla guarda esta respuesta como "la tarea", y sin `objetivo_logrado` la
        // Pieza de campaña mostraba "NaN" hasta volver a abrirla.
        if (card.report) {
            card.report.dataValues.objetivo_logrado = await getObjetivoLogrado(card.report.id, card.report.objetivo?.id);
        }

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
        console.error('Error en getAssignedToMe:', error);
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

/**
 * POST /tasks_cards/:id/notify — avisa por WhatsApp a TODOS los responsables de la tarea (los que estén
 * seleccionados al momento de pulsar el botón). Es manual a propósito: el formulario de la tarea se autoguarda y
 * avisar en cada cambio llenaría de mensajes a la gente.
 */
const hasValidPhone = (phone) => /^\d{8,15}$/.test(String(phone ?? '').replace(/\D/g, ''));

/**
 * GET /tasks_cards/:id/notify_preview — antes de enviar el aviso, dice cuáles responsables tienen teléfono. No expone
 * los números, solo si cada uno tiene uno válido.
 */
const notifyPreview = async (req, res) => {
    try {
        const card = await md.tasks_cards.scope(['withResponsibles']).findByPk(req.params.id);
        if (!card) return res.status(404).json({ message: 'No se encontró la tarjeta' });
        const users = card.responsibles.length
            ? await md.usuarios.findAll({ where: { id: card.responsibles.map((r) => r.id) }, attributes: ['id', 'nombre', 'phone'] })
            : [];
        res.status(200).json({
            responsables: users.map((u) => ({ id: u.id, nombre: u.nombre, tiene_telefono: hasValidPhone(u.phone) })),
        });
    } catch (error) {
        res.status(500).json({ message: 'No se pudo revisar a los responsables' });
    }
};

const notifyResponsibles = async (req, res) => {
    try {
        const card = await md.tasks_cards.scope(['withResponsibles', 'withReport']).findByPk(req.params.id);
        if (!card) return res.status(404).json({ message: 'No se encontró la tarjeta' });
        if (!card.responsibles?.length) {
            return res.status(400).json({ message: 'La tarea no tiene responsables seleccionados.' });
        }

        const users = await md.usuarios.findAll({
            where: { id: card.responsibles.map((r) => r.id) },
            attributes: ['id', 'nombre', 'phone'],
        });
        const cliente = [card.report?.campana?.categoria?.empresa?.nombre, card.report?.campana?.nombre]
            .filter(Boolean)
            .join(' - ') || 'Sin campaña';
        const estado = LIST_NAMES[card.list_id] ?? 'Pendientes';

        const summary = await notifyUsuarios('tarea_asignada', users.map((u) => ({
            nombre: u.nombre,
            telefono: u.phone,
            data: { tarea: card.name || 'Sin título', cliente, estado, cardId: card.id },
        })));

        if (summary.enviados > 0) {
            await card.update({ last_notified_at: new Date() });
        }
        await md.tasks_activities.create({
            card_id: card.id,
            date_activity: new Date(),
            activity_detail: summary.enviados > 0
                ? `Aviso por WhatsApp enviado a: ${users.filter((u) => !summary.sinTelefono.includes(u.nombre)).map((u) => u.nombre).join(', ')}`
                : 'Se intentó avisar por WhatsApp, pero no se pudo enviar a ningún responsable',
            responsible_id: req.user.id,
        });

        res.status(200).json({ ...summary, last_notified_at: card.last_notified_at });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'No se pudo enviar el aviso por WhatsApp' });
    }
};

const remove = async (req, res) => {
    try {
        const id = req.params.id;
        const card = await md.tasks_cards.findByPk(id);
        if (!card) {
            return res.status(404).json({ message: 'No se encontró la tarjeta' });
        }
        if (!canEditCard(req.user, card)) return res.status(400).json(DELETE_DENIED);
        await card.destroy();
        return res.status(200).json({ message: 'Tarjeta eliminada correctamente' });
    } catch (error) {
        return res.status(500).json({ message: 'Error al eliminar la tarjeta' });
    }
};

module.exports = {
    canEditCard,
    EDIT_DENIED,
    getById,
    save,
    update,
    remove,
    getAssignedToMe,
    markAssignedAsRead,
    markAllAssignedAsRead,
    notifyResponsibles,
    notifyPreview,
};