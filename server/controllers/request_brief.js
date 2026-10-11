const md = require('../models');
const { notifyProceso } = require('../services/whatsappNotificationService');
const { verifyBriefCode } = require('../utils/briefLink');
const { getLatestByBriefIds, checkCanInvalidate, deleteProposals, removeFiles } = require('./planificador/proposal_service');

const getAll = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const offset = (page - 1) * limit;

        const requestBriefs = await md.request_brief.findAndCountAll({
            attributes: ['id', 'nombre_empresa', 'nombre_campana', 'responsable', 'mail', 'reviewed', 'fecha_creacion', 'copia_from'],
            include: [
                {
                    model: md.qualify_brief,
                    as: 'qualify_brief',
                    attributes: ['qualify'],
                    required: false,
                },
            ],
            order: [
                ['fecha_creacion', 'DESC'],
                ['copia_from', 'ASC'],
            ],
            limit,
            offset,
        });
        // Estado de la propuesta (PDF) de cada brief: respuesta del cliente (null=pendiente).
        const propuestas = await getLatestByBriefIds(requestBriefs.rows.map((r) => r.id));
        const rows = requestBriefs.rows.map((r) => ({ ...r.toJSON(), propuesta: propuestas.get(r.id) || null }));
        res.status(200).json({ count: requestBriefs.count, rows });
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las solicitudes de brief: ${error.message}` });
    }
};

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const requestBrief = await md.request_brief.findByPk(id, {
            include: [
                {
                    model: md.qualify_brief,
                    as: 'qualify_brief',
                    attributes: ['qualify'],
                    required: false,
                },
            ],
        });
        if (!requestBrief) {
            return res.status(404).json({ message: 'No se encontró la solicitud de brief' });
        }
        const propuestas = await getLatestByBriefIds([requestBrief.id]);
        res.status(200).json({ ...requestBrief.toJSON(), propuesta: propuestas.get(requestBrief.id) || null });
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la solicitud de brief: ${error.message}` });
    }
};

// Copia todos los campos de la solicitud original hacia una nueva fila (igual
// que la app antigua): útil para no cargar todo el brief de cero cuando es
// prácticamente el mismo. La copia arranca sin revisar (reviewed=false) y sin
// calificación/imágenes propias (qualify_brief/qualify_image no se duplican,
// son filas nuevas sin relación).
const duplicate = async (req, res) => {
    try {
        const { id } = req.params;
        const original = await md.request_brief.findByPk(id);
        if (!original) {
            return res.status(404).json({ message: 'No se encontró la solicitud de brief a copiar' });
        }

        const data = original.toJSON();
        delete data.id;
        delete data.fecha_creacion;
        data.fecha_modificacion = null;
        data.usuario_modificacion = null;
        data.reviewed = false;
        data.copia_from = original.id;

        const copy = await md.request_brief.create(data);
        res.status(200).json({ message: 'Solicitud de brief copiada correctamente', data: copy });
    } catch (error) {
        res.status(500).json({ message: `Error al copiar la solicitud de brief: ${error.message}` });
    }
};

// Campos que el staff puede editar desde el tab "Detalle" para completar/ajustar
// lo que el cliente cargó en el formulario público — sobre todo pensado para
// que el Planificador tenga de dónde leer Estrategia/Audiencia al armar el PDF
// de la propuesta (antes se editaba en un wizard aparte al generar el PDF, acá
// queda persistido en el brief como cualquier otro dato).
const STRATEGY_FIELDS = [
    'estrategia',
    'url_destino',
    'intereses',
    'segmentacion_sexo',
    'segmentacion_edad',
    'geolocalizacion_ciudad',
];

const updateStrategy = async (req, res) => {
    try {
        const { id } = req.params;
        const requestBrief = await md.request_brief.findByPk(id);
        if (!requestBrief) {
            return res.status(404).json({ message: 'No se encontró la solicitud de brief' });
        }

        const data = {};
        STRATEGY_FIELDS.forEach((field) => {
            if (req.body[field] !== undefined) data[field] = req.body[field];
        });

        // Estos campos se muestran en el PDF de la propuesta (Objetivo, Audiencia): si
        // alguno realmente cambió, el PDF vigente queda obsoleto y se invalida (con la
        // misma regla que la cotización si el cliente ya lo aceptó). Valores vacíos
        // (null / '' / []) se consideran iguales y los arreglos se comparan como conjuntos.
        const normalize = (v) => {
            if (Array.isArray(v)) return JSON.stringify([...v].map(String).sort());
            return v === null || v === undefined ? '' : String(v).trim();
        };
        const normalizeEmptyArray = (v) => (Array.isArray(v) && v.length === 0 ? '' : normalize(v));
        const changed = Object.keys(data).some((field) => normalizeEmptyArray(data[field]) !== normalizeEmptyArray(requestBrief[field]));

        let oldFiles = [];
        if (changed) {
            const blocked = await checkCanInvalidate({
                id_brief: requestBrief.id,
                user: req.user,
                confirmEditAccepted: req.body.confirm_edit_accepted === true,
            });
            if (blocked) return res.status(blocked.status).json(blocked.body);
        }

        data.usuario_modificacion = req.user.id;
        data.fecha_modificacion = new Date();

        await requestBrief.update(data);
        if (changed) {
            oldFiles = await deleteProposals(requestBrief.id);
            removeFiles(oldFiles);
        }
        res.status(200).json({ ...requestBrief.toJSON(), proposal_invalidated: oldFiles.length > 0 });
    } catch (error) {
        res.status(500).json({ message: `Error al guardar la estrategia del brief: ${error.message}` });
    }
};

// --- FORMULARIO PÚBLICO DE BRIEF (sin login) -------------------------------
// El cliente llena el brief desde el formulario público del frontend nuevo. Solo
// guarda el registro (reviewed = false); no envía correos ni avisos.

const MAX_LENGTHS = {
    nombre_empresa: 100,
    nombre_campana: 200,
    responsable: 150,
    mail: 100,
    telefono: 100,
    url: 200,
    url_destino: 200,
    url_fanpage: 200,
    url_instagram: 200,
    url_youtube: 200,
    url_twitter: 200,
    url_linkedin: 200,
    url_descarga_app: 200,
    competencia_directa: 3000,
    publico_objetivo: 3000,
    kpis: 3000,
    entregables: 3000,
};
const REQUIRED_TEXT = ['nombre_empresa', 'responsable', 'nombre_campana', 'mail', 'telefono', 'descripcion', 'publico_objetivo', 'slogan'];
const OPTIONAL_TEXT = [
    'url', 'url_fanpage', 'url_instagram', 'url_youtube', 'url_linkedin', 'competencia_directa', 'kpis', 'entregables',
];
const MONEDAS_VALIDAS = ['$us.', 'Bs.'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

// Valida y normaliza el body del formulario público. Devuelve { data } o { error }.
const buildPublicBriefData = (body) => {
    const data = {};

    for (const field of REQUIRED_TEXT) {
        const value = cleanText(body[field]);
        if (!value) return { error: `El campo "${field}" es obligatorio.` };
        if (MAX_LENGTHS[field] && value.length > MAX_LENGTHS[field]) {
            return { error: `El campo "${field}" supera los ${MAX_LENGTHS[field]} caracteres.` };
        }
        data[field] = value;
    }
    if (!EMAIL_REGEX.test(data.mail)) return { error: 'El correo no es válido.' };
    if (data.descripcion.length > 5000) return { error: 'El objetivo de la campaña es demasiado largo.' };

    for (const field of OPTIONAL_TEXT) {
        const value = cleanText(body[field]);
        if (MAX_LENGTHS[field] && value.length > MAX_LENGTHS[field]) {
            return { error: `El campo "${field}" supera los ${MAX_LENGTHS[field]} caracteres.` };
        }
        data[field] = value || null;
    }
    if (data.slogan.length > 3000) return { error: 'El mensaje clave es demasiado largo.' };

    if (typeof body.recursos_graficos !== 'boolean' || typeof body.recursos_audiovisuales !== 'boolean') {
        return { error: 'Indique si cuenta con recursos gráficos y audiovisuales.' };
    }
    data.recursos_graficos = body.recursos_graficos;
    data.recursos_audiovisuales = body.recursos_audiovisuales;

    if (!DATE_REGEX.test(body.fecha_inicio) || !DATE_REGEX.test(body.fecha_fin)) {
        return { error: 'Las fechas de la campaña no son válidas.' };
    }
    if (body.fecha_fin < body.fecha_inicio) return { error: 'La fecha final no puede ser anterior a la inicial.' };
    data.fecha_inicio = body.fecha_inicio;
    data.fecha_fin = body.fecha_fin;

    const presupuesto = Number(body.presupuesto);
    if (!Number.isFinite(presupuesto) || presupuesto < 0 || presupuesto >= 100000000) {
        return { error: 'El presupuesto no es válido.' };
    }
    data.presupuesto = presupuesto;
    if (!MONEDAS_VALIDAS.includes(body.moneda)) return { error: 'La moneda no es válida.' };
    data.moneda = body.moneda;

    // El formulario simplificado ya no pregunta segmentación ni etapas del embudo (el equipo las completa al
    // armar la estrategia, desde el detalle del brief). Las columnas de la base son NOT NULL (tabla compartida
    // con la app antigua), así que se guardan vacías / en falso.
    data.geolocalizacion = 'Bolivia';
    data.geolocalizacion_ciudad = [];
    data.segmentacion_edad = [];
    data.segmentacion_sexo = [];
    data.intereses = [];
    data.medios = [];
    data.funnel_stage_1 = false;
    data.funnel_stage_2 = false;
    data.funnel_stage_3 = false;
    data.funnel_stage_4 = false;

    const comentarios = cleanText(body.comentarios);
    if (comentarios.length > 5000) return { error: 'Los detalles adicionales son demasiado largos.' };
    data.comments = comentarios || null;

    return { data };
};

const createPublic = async (req, res) => {
    try {
        // Campo señuelo: un humano nunca lo ve ni lo llena. Si viene con texto es un
        // bot — se responde "ok" sin guardar nada para no darle información.
        if (cleanText(req.body.website_confirm)) {
            return res.status(201).json({ message: 'Solicitud recibida' });
        }

        const { data, error } = buildPublicBriefData(req.body || {});
        if (error) return res.status(400).json({ message: error });

        const created = await md.request_brief.create({
            ...data,
            reviewed: false,
            fecha_creacion: new Date(),
        });
        // Aviso por WhatsApp a los números suscritos al proceso. No se espera ni puede romper la respuesta
        // al cliente: notifyProceso no lanza errores y deja los fallos en el log.
        notifyProceso('nuevo_brief', { brief: created });
        res.status(201).json({ message: 'Solicitud recibida', id: created.id });
    } catch (error) {
        res.status(500).json({ message: 'No se pudo guardar su solicitud. Intente nuevamente en unos minutos.' });
    }
};

// Campos del brief que ve quien abre el link firmado (botón de la plantilla de WhatsApp, sin login).
// Solo lo que llenó el cliente: nunca la estrategia, los comentarios internos, la calificación ni la propuesta.
const PUBLIC_VIEW_FIELDS = [
    'id', 'nombre_empresa', 'nombre_campana', 'responsable', 'mail', 'telefono', 'descripcion', 'slogan',
    'competencia_directa', 'publico_objetivo', 'kpis', 'entregables', 'comments', 'url', 'url_destino', 'url_fanpage', 'url_instagram', 'url_youtube', 'url_twitter',
    'url_linkedin', 'url_descarga_app', 'recursos_graficos', 'recursos_audiovisuales', 'fecha_inicio', 'fecha_fin',
    'presupuesto', 'moneda', 'geolocalizacion', 'geolocalizacion_ciudad', 'segmentacion_edad', 'segmentacion_sexo',
    'intereses', 'medios', 'funnel_stage_1', 'funnel_stage_2', 'funnel_stage_3', 'funnel_stage_4', 'fecha_creacion',
];

// GET /public/request_briefs/view/:code — brief de solo lectura para quien tiene el link firmado.
// Si el código no es válido (formato o firma) o el brief no existe responde lo mismo, sin dar pistas.
const getPublicView = async (req, res) => {
    const notFound = () => res.status(404).json({ message: 'Este link no es válido o ya no está disponible.' });
    try {
        const id = verifyBriefCode(req.params.code);
        if (!id) return notFound();
        const brief = await md.request_brief.findByPk(id, { attributes: PUBLIC_VIEW_FIELDS });
        if (!brief) return notFound();
        res.status(200).json(brief);
    } catch (error) {
        res.status(500).json({ message: 'No se pudo cargar el brief. Intente nuevamente en unos minutos.' });
    }
};

module.exports = {
    getAll,
    getById,
    duplicate,
    updateStrategy,
    createPublic,
    getPublicView,
};
