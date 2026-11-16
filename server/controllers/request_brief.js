const md = require('../models');
const { QueryTypes } = require('sequelize');
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
//
// Son todos los campos que el formulario público NO pregunta (más Estrategia): Url destino, Url descarga App, Recursos
// gráficos/audiovisuales, Medios y la segmentación. `geolocalizacion` (el país) NO está aquí: la llena el cliente en el
// formulario (ver createPublic) y en el detalle se consulta, como el resto de lo que llena el cliente. Lo que el cliente sí llena
// (contacto, objetivo, redes, fechas, presupuesto...) no se edita aquí.
const STRATEGY_FIELDS = [
    'estrategia',
    'url_destino',
    'url_descarga_app',
    'recursos_graficos',
    'recursos_audiovisuales',
    'geolocalizacion_ciudad',
    'segmentacion_edad',
    'segmentacion_sexo',
    'intereses',
    'medios',
];
// De esos, los que se muestran en el PDF de la propuesta (portada, resumen ejecutivo y audiencia, ver
// planificador/pdf_template.js): solo si cambia alguno el PDF vigente queda obsoleto y se invalida. Los demás (Url destino,
// Url descarga App, Recursos, Geolocalización y Medios) no aparecen en el PDF, así que editarlos no lo toca.
const PDF_STRATEGY_FIELDS = ['estrategia', 'intereses', 'segmentacion_sexo', 'segmentacion_edad', 'geolocalizacion_ciudad'];

const STRATEGY_LABELS = {
    estrategia: 'Estrategia', url_destino: 'Url destino', url_descarga_app: 'Url descarga App',
    recursos_graficos: 'Recursos gráficos', recursos_audiovisuales: 'Recursos audiovisuales',
    geolocalizacion_ciudad: 'Ciudades', segmentacion_edad: 'Edad',
    segmentacion_sexo: 'Sexo', intereses: 'Intereses', medios: 'Medios',
};
const STRATEGY_TEXT_MAX = { url_destino: 200, url_descarga_app: 200, estrategia: 10000 };
const STRATEGY_BOOLEANS = ['recursos_graficos', 'recursos_audiovisuales'];
const STRATEGY_LISTS = ['geolocalizacion_ciudad', 'segmentacion_edad', 'segmentacion_sexo', 'intereses', 'medios'];

// Valida y normaliza lo que llega a updateStrategy. Devuelve { data } o { error }. Solo mira los campos que vienen en el
// cuerpo (cada bloque de la pantalla guarda únicamente los suyos).
const buildStrategyData = (body) => {
    const data = {};
    for (const field of STRATEGY_FIELDS) {
        const value = body[field];
        if (value === undefined) continue;
        const label = STRATEGY_LABELS[field];
        if (STRATEGY_BOOLEANS.includes(field)) {
            if (typeof value !== 'boolean') return { error: `El campo "${label}" debe ser Sí o No.` };
            data[field] = value;
        } else if (STRATEGY_LISTS.includes(field)) {
            if (!Array.isArray(value) || value.length > 100 || value.some((item) => typeof item !== 'string')) {
                return { error: `El campo "${label}" no es válido.` };
            }
            const items = value.map((item) => item.trim()).filter(Boolean);
            if (items.some((item) => item.length > 100)) return { error: `Cada valor de "${label}" admite hasta 100 caracteres.` };
            data[field] = items;
        } else {
            if (value !== null && typeof value !== 'string') return { error: `El campo "${label}" no es válido.` };
            const text = value === null ? null : value.trim();
            if (text && text.length > STRATEGY_TEXT_MAX[field]) {
                return { error: `El campo "${label}" supera los ${STRATEGY_TEXT_MAX[field]} caracteres.` };
            }
            data[field] = text || null;
        }
    }
    return { data };
};

const updateStrategy = async (req, res) => {
    try {
        const { id } = req.params;
        const requestBrief = await md.request_brief.findByPk(id);
        if (!requestBrief) {
            return res.status(404).json({ message: 'No se encontró la solicitud de brief' });
        }

        const { data, error } = buildStrategyData(req.body || {});
        if (error) return res.status(400).json({ message: error });

        // Los campos de PDF_STRATEGY_FIELDS se muestran en el PDF de la propuesta (Objetivo, Audiencia): si
        // alguno realmente cambió, el PDF vigente queda obsoleto y se invalida (con la
        // misma regla que la cotización si el cliente ya lo aceptó). Valores vacíos
        // (null / '' / []) se consideran iguales y los arreglos se comparan como conjuntos.
        const normalize = (v) => {
            if (Array.isArray(v)) return JSON.stringify([...v].map(String).sort());
            return v === null || v === undefined ? '' : String(v).trim();
        };
        const normalizeEmptyArray = (v) => (Array.isArray(v) && v.length === 0 ? '' : normalize(v));
        const changed = Object.keys(data)
            .filter((field) => PDF_STRATEGY_FIELDS.includes(field))
            .some((field) => normalizeEmptyArray(data[field]) !== normalizeEmptyArray(requestBrief[field]));

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

// --- PAÍSES DEL FORMULARIO PÚBLICO ------------------------------------------
// El país del brief (`geolocalizacion`) debe ser uno de los mapas de la tabla `mapas` (compartida con la app antigua): esa app
// busca el mapa POR NOMBRE al activar la campaña y falla si el nombre no existe. Por eso la lista sale de esa tabla y no está
// escrita aquí. Bolivia (el primero) es el valor por defecto.
const DEFAULT_COUNTRY = 'Bolivia';

const getCountryNames = async () => {
    const rows = await md.sequelize.query('SELECT mapa FROM mapas ORDER BY id', { type: QueryTypes.SELECT });
    return rows.map((row) => row.mapa);
};

// GET /public/request_briefs/countries — países que puede elegir el cliente en el formulario público (sin login).
const getCountries = async (req, res) => {
    try {
        res.status(200).json(await getCountryNames());
    } catch (error) {
        res.status(500).json({ message: 'No se pudo obtener la lista de países.' });
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
    url_tiktok: 200,
    url_descarga_app: 200,
    competencia_directa: 3000,
    publico_objetivo: 3000,
    kpis: 3000,
    entregables: 3000,
};
const REQUIRED_TEXT = ['nombre_empresa', 'responsable', 'nombre_campana', 'mail', 'telefono', 'descripcion', 'publico_objetivo'];
const OPTIONAL_TEXT = [
    'slogan', 'url', 'url_fanpage', 'url_instagram', 'url_tiktok', 'url_youtube', 'url_linkedin', 'url_twitter', 'competencia_directa', 'kpis', 'entregables',
];
const MONEDAS_VALIDAS = ['$us.', 'Bs.'];
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const cleanText = (value) => (typeof value === 'string' ? value.trim() : '');

// 'AAAA-MM-DD' que además sea un día real del calendario: la expresión regular deja pasar "2026-02-31" (se guardaba como otra
// fecha, 3 de marzo) y "2026-13-01" (la base lo rechazaba y el cliente veía un error genérico).
const isRealDate = (value) => {
    if (typeof value !== 'string' || !DATE_REGEX.test(value)) return false;
    const [y, m, d] = value.split('-').map(Number);
    const date = new Date(Date.UTC(y, m - 1, d));
    return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
};

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
    if (data.slogan && data.slogan.length > 3000) return { error: 'El mensaje clave es demasiado largo.' };

    // El formulario ya no pregunta por separado si cuenta con recursos gráficos o audiovisuales: lo explica el
    // cliente en "Entregables / Formatos". Las columnas son NOT NULL (tabla compartida con la app antigua).
    data.recursos_graficos = body.recursos_graficos === true;
    data.recursos_audiovisuales = body.recursos_audiovisuales === true;

    if (!isRealDate(body.fecha_inicio) || !isRealDate(body.fecha_fin)) {
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
    // `geolocalizacion` (país): la columna es obligatoria. Aquí va el valor por defecto; createPublic lo reemplaza por el
    // país que eligió el cliente, ya validado contra la tabla `mapas`.
    data.geolocalizacion = DEFAULT_COUNTRY;
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

        // País elegido por el cliente (por defecto Bolivia). Debe existir en la tabla `mapas`.
        const pais = cleanText(req.body.geolocalizacion) || DEFAULT_COUNTRY;
        if (!(await getCountryNames()).includes(pais)) {
            return res.status(400).json({ message: 'El país seleccionado no es válido.' });
        }
        data.geolocalizacion = pais;

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
    'url_linkedin', 'url_tiktok', 'url_descarga_app', 'recursos_graficos', 'recursos_audiovisuales', 'fecha_inicio', 'fecha_fin',
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
    getCountries,
    createPublic,
    getPublicView,
};
