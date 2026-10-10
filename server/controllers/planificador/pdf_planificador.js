'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const md = require('../../models');
const { renderPlanificadorPdf } = require('./pdf_template');
const { UPLOADS_PATH, findLatest, deleteProposals, removeFiles } = require('./proposal_service');

const TIPOS_VALIDOS = ['CPC_CPV', 'CPM'];

const sendPdf = (res, id_brief, buffer, token) => {
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=propuesta_brief_${id_brief}.pdf`);
    if (token) res.setHeader('X-Proposal-Token', token);
    res.send(buffer);
};

// "Generar PDF" = revisar el PDF de la propuesta. Solo se crea una fila nueva en
// pdf_planificador (y un token/link nuevo) cuando no hay un PDF vigente para la
// cotización actual: la primera vez, o después de modificarla (guardar cambios borra
// la fila anterior — ver proposal_service). Si ya hay uno vigente con los mismos
// tipos, se devuelve tal cual está guardado: es exactamente lo que ve el cliente.
// Una propuesta ACEPTADA se devuelve siempre tal cual (es lo que el cliente aceptó).
const generate = async (req, res) => {
    try {
        const { id_brief } = req.params;
        const tipos = [...new Set(Array.isArray(req.body.tipos) ? req.body.tipos.filter((t) => TIPOS_VALIDOS.includes(t)) : [])].sort();

        if (tipos.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos un tipo (CPC/CPV/CPE o CPM).' });
        }
        const tiposKey = tipos.join(',');

        const existing = await findLatest(id_brief);
        // `regenerateInto`: la fila ya existe pero su archivo se perdió del disco; se
        // vuelve a renderizar y se actualiza esa misma fila (no se crea otra).
        let regenerateInto = null;
        if (existing) {
            const reusable = existing.respuesta === true || (existing.token && existing.tipos === tiposKey);
            if (reusable) {
                const filePath = path.join(UPLOADS_PATH, path.basename(existing.pdf));
                if (fs.existsSync(filePath)) {
                    return sendPdf(res, id_brief, fs.readFileSync(filePath), existing.token);
                }
                regenerateInto = existing;
            }
        }
        // Al regenerar una propuesta aceptada se respetan los tipos con los que se aceptó.
        const tiposToRender = regenerateInto?.tipos ? regenerateInto.tipos.split(',') : tipos;

        // El grupo NUNCA se toma del cliente: se deriva siempre de la
        // calificación vigente del brief (misma fuente que usa la grilla de
        // cotización). Si se confiara en el grupo que manda el front, un
        // brief recalificado después de guardar la cotización (grupo viejo
        // distinto al actual) generaba "No hay líneas" aunque sí hubiera
        // cotización guardada, porque buscaba con el grupo equivocado.
        const brief = await md.request_brief.findByPk(id_brief, {
            include: [{ model: md.qualify_brief, as: 'qualify_brief', attributes: ['qualify'], required: false }],
        });
        if (!brief) {
            return res.status(404).json({ message: 'Brief no encontrado.' });
        }
        const grupo = brief.qualify_brief?.qualify;
        if (!grupo) {
            return res.status(400).json({ message: 'El brief todavía no está calificado.' });
        }

        const [lineasPorTipo, summariesPorTipo, objetivos] = await Promise.all([
            Promise.all(tiposToRender.map((tipo) => md.performance_branding.findAll({
                where: { id_brief, grupo, tipo, activo: true },
                include: [{ model: md.plataformas, as: 'plataforma', attributes: ['id', 'plataforma'], required: false }],
                order: [['id_plataforma', 'ASC'], ['id', 'ASC']],
            }))),
            Promise.all(tiposToRender.map((tipo) => md.summary.findAll({ where: { id_brief, grupo, tipo } }))),
            md.objetivos.findAll({ attributes: ['id', 'objetivo'] }),
        ]);

        // Si alguno de los tipos pedidos no tiene líneas guardadas, esa sección
        // simplemente no entra al PDF (no se aborta todo el documento por eso) —
        // solo falla si NINGUNO de los tipos seleccionados tiene datos.
        // CPM siempre va primero en el PDF, luego CPC/CPV/CPE.
        const secciones = tiposToRender
            .map((tipo, i) => ({ tipo, lineas: lineasPorTipo[i], summaries: summariesPorTipo[i] }))
            .filter((s) => s.lineas.length > 0)
            .sort((a, b) => (b.tipo === 'CPM') - (a.tipo === 'CPM'));

        if (secciones.length === 0) {
            return res.status(400).json({ message: 'No hay líneas de cotización guardadas para ninguno de los tipos seleccionados.' });
        }

        // Valida TODOS los tipos incluidos en el PDF, no solo el que el
        // usuario tenga abierto en pantalla — cada pestaña del Planificador
        // (CPC/CPV/CPE y CPM) es una grilla separada en el frontend, así que
        // su validación de "KPI obligatorio" solo ve la pestaña activa. Acá
        // sí se ven todas las líneas reales de todos los tipos pedidos.
        const lineaSinKpi = secciones
            .flatMap((s) => s.lineas)
            .find((l) => !l.kpi_principal || !l.kpi_secundario);
        if (lineaSinKpi) {
            return res.status(400).json({
                message: `La línea "${lineaSinKpi.nombre}" necesita un KPI principal y un KPI secundario antes de generar el PDF. Revisa la pestaña correspondiente en el Planificador.`,
            });
        }

        const objetivosById = new Map(objetivos.map((o) => [o.id, o.objetivo]));

        // `modelo` (CPC/CPV/CPE) vive en costo_por, no en performance_branding:
        // se trae por id_costo para poder agrupar las líneas en el PDF.
        const idsCosto = [...new Set(secciones.flatMap((s) => s.lineas.map((l) => l.id_costo)).filter(Boolean))];
        const costos = idsCosto.length
            ? await md.costo_por.findAll({ where: { id: idsCosto }, attributes: ['id', 'modelo'] })
            : [];
        const modeloByCosto = new Map(costos.map((c) => [c.id, c.modelo]));

        const buffer = await renderPlanificadorPdf({
            brief: brief.toJSON(),
            secciones: secciones.map((s) => ({
                tipo: s.tipo,
                lineas: s.lineas.map((l) => ({ ...l.toJSON(), modelo: modeloByCosto.get(l.id_costo) || null })),
                summaryByCosto: new Map(s.summaries.map((sm) => [sm.id_costo, sm.summary_meses])),
            })),
            objetivosById,
        });

        const filename = `${Date.now()}.pdf`;
        if (!fs.existsSync(UPLOADS_PATH)) {
            fs.mkdirSync(UPLOADS_PATH, { recursive: true });
        }
        fs.writeFileSync(path.join(UPLOADS_PATH, filename), buffer);

        if (regenerateInto) {
            const previousFile = regenerateInto.pdf;
            await regenerateInto.update({ pdf: filename });
            removeFiles([previousFile]);
            return sendPdf(res, id_brief, buffer, regenerateInto.token);
        }

        // Token de la vista pública (/propuesta/:token) donde el cliente ve este PDF y
        // acepta/rechaza — random, no el nombre del archivo (que es solo un timestamp
        // adivinable). Solo hay una fila por brief: las anteriores (obsoletas) se borran
        // junto con su archivo, y sus links dejan de funcionar.
        const token = crypto.randomBytes(32).toString('hex');

        const t = await md.sequelize.transaction();
        let oldFiles = [];
        try {
            oldFiles = await deleteProposals(id_brief, t);
            await md.pdf_planificador.create({
                id_brief,
                usuario_creacion: req.user.id,
                pdf: filename,
                token,
                tipos: tiposKey,
                activo: true,
            }, { transaction: t });
            await t.commit();
        } catch (error) {
            await t.rollback();
            removeFiles([filename]);
            throw error;
        }
        removeFiles(oldFiles);

        sendPdf(res, id_brief, buffer, token);
    } catch (error) {
        res.status(500).json({ message: `Error al generar el PDF: ${error.message}` });
    }
};

// --- VISTA PÚBLICA (sin login) --------------------------------------------
// El cliente entra con el token que le pasó el staff, ve el PDF y responde
// aceptar/rechazar. Ninguna de estas rutas usa sessionAuth.

const getByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const propuesta = await md.pdf_planificador.findOne({
            where: { token },
            include: [{ model: md.request_brief, as: 'request_brief', attributes: ['nombre_empresa', 'nombre_campana'] }],
        });
        if (!propuesta) {
            return res.status(404).json({ message: 'Este link no es válido o ya no está disponible.' });
        }
        res.status(200).json({
            activo: propuesta.activo,
            respuesta: propuesta.respuesta,
            nombre_empresa: propuesta.request_brief?.nombre_empresa,
            nombre_campana: propuesta.request_brief?.nombre_campana,
        });
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la propuesta: ${error.message}` });
    }
};

const downloadByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const propuesta = await md.pdf_planificador.findOne({ where: { token } });
        if (!propuesta) {
            return res.status(404).json({ message: 'Este link no es válido o ya no está disponible.' });
        }
        const filePath = path.join(UPLOADS_PATH, propuesta.pdf);
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ message: 'El archivo del PDF no se encuentra.' });
        }
        res.setHeader('Content-Type', 'application/pdf');
        res.sendFile(filePath);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el PDF: ${error.message}` });
    }
};

const respondByToken = async (req, res) => {
    try {
        const { token } = req.params;
        const { respuesta } = req.body;
        if (typeof respuesta !== 'boolean') {
            return res.status(400).json({ message: 'respuesta debe ser true o false.' });
        }
        // Solo se puede responder una vez: si ya no está activo (regenerado o ya
        // respondido antes), el link quedó obsoleto.
        const propuesta = await md.pdf_planificador.findOne({ where: { token, activo: true } });
        if (!propuesta) {
            return res.status(404).json({ message: 'Este link ya no está disponible.' });
        }
        await propuesta.update({ respuesta, activo: false });
        res.status(200).json({ message: 'Respuesta registrada correctamente.' });
    } catch (error) {
        res.status(500).json({ message: `Error al registrar la respuesta: ${error.message}` });
    }
};

module.exports = { generate, getByToken, downloadByToken, respondByToken };
