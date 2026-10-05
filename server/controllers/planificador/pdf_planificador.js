'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const md = require('../../models');
const { renderPlanificadorPdf } = require('./pdf_template');

// Carpeta compartida con el backend antiguo — ver LEGACY_PDF_PLANIFICADOR_UPLOADS_PATH
// en .env (misma tabla `pdf_planificador`, misma carpeta física en ambos sistemas).
const UPLOADS_PATH = process.env.LEGACY_PDF_PLANIFICADOR_UPLOADS_PATH
    || path.join(__dirname, '..', '..', 'uploads', 'pdf_planificador');

const generate = async (req, res) => {
    try {
        const { id_brief } = req.params;
        const tipos = Array.isArray(req.body.tipos) ? req.body.tipos.filter(Boolean) : [];

        if (tipos.length === 0) {
            return res.status(400).json({ message: 'Debe seleccionar al menos un tipo (CPC/CPV/CPE o CPM).' });
        }

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
            Promise.all(tipos.map((tipo) => md.performance_branding.findAll({
                where: { id_brief, grupo, tipo, activo: true },
                include: [{ model: md.plataformas, as: 'plataforma', attributes: ['id', 'plataforma'], required: false }],
                order: [['id_plataforma', 'ASC'], ['id', 'ASC']],
            }))),
            Promise.all(tipos.map((tipo) => md.summary.findAll({ where: { id_brief, grupo, tipo } }))),
            md.objetivos.findAll({ attributes: ['id', 'objetivo'] }),
        ]);

        // Si alguno de los tipos pedidos no tiene líneas guardadas, esa sección
        // simplemente no entra al PDF (no se aborta todo el documento por eso) —
        // solo falla si NINGUNO de los tipos seleccionados tiene datos.
        const secciones = tipos
            .map((tipo, i) => ({ tipo, lineas: lineasPorTipo[i], summaries: summariesPorTipo[i] }))
            .filter((s) => s.lineas.length > 0);

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

        const buffer = await renderPlanificadorPdf({
            brief: brief.toJSON(),
            secciones: secciones.map((s) => ({
                tipo: s.tipo,
                lineas: s.lineas.map((l) => l.toJSON()),
                summaryByCosto: new Map(s.summaries.map((sm) => [sm.id_costo, sm.summary_meses])),
            })),
            objetivosById,
        });

        const filename = `${Date.now()}.pdf`;
        if (!fs.existsSync(UPLOADS_PATH)) {
            fs.mkdirSync(UPLOADS_PATH, { recursive: true });
        }
        fs.writeFileSync(path.join(UPLOADS_PATH, filename), buffer);

        // Token de la vista pública (/propuesta/:token) donde el cliente ve este PDF y
        // acepta/rechaza — random, no el nombre del archivo (que es solo un timestamp
        // adivinable). Al regenerar el PDF, el link anterior queda inválido (esa fila
        // pasa a activo:false), igual criterio que ya existía para el resto del flujo.
        const token = crypto.randomBytes(32).toString('hex');

        await md.pdf_planificador.update({ activo: false }, { where: { id_brief, activo: true } });
        await md.pdf_planificador.create({
            id_brief,
            usuario_creacion: req.user.id,
            pdf: filename,
            token,
            activo: true,
        });

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename=propuesta_brief_${id_brief}.pdf`);
        res.setHeader('X-Proposal-Token', token);
        res.send(buffer);
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
