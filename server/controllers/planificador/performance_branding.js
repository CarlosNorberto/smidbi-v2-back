const md = require('../../models');

// Calcula el objetivo (alcance/clics/views para CPC_CPV, impresiones para CPM)
// a partir de la inversión y el costo unitario. Se recalcula siempre en el
// servidor (no se confía en lo que mande el cliente).
const calcularObjetivo = (tipo, inversion, costo) => {
    const inv = Number(inversion) || 0;
    const cost = Number(costo) || 0;
    if (!cost) return 0;
    if (tipo === 'CPM') {
        return Math.round((inv / cost) * 1000);
    }
    return Math.round(inv / cost);
};

// Suma de todos los "valor" de summary_meses (debe dar 100, son % de la
// inversión de esa línea distribuidos por semana).
const sumaSummaryMeses = (summaryMeses) => {
    if (!Array.isArray(summaryMeses)) return 0;
    return summaryMeses.reduce((total, mes) => {
        const semanas = Array.isArray(mes.semanas) ? mes.semanas : [];
        return total + semanas.reduce((acc, semana) => acc + (Number(semana.valor) || 0), 0);
    }, 0);
};

// Distribución por defecto cuando el usuario todavía no armó una manual: 100%
// en la primera semana del mes actual, para que la línea nunca quede en un
// estado de distribución inconsistente/vacío.
const defaultSummaryMeses = () => ([
    {
        mes: new Date().getMonth() + 1,
        semanas: [{ valor: 100 }, { valor: 0 }, { valor: 0 }, { valor: 0 }],
    },
]);

const getByBrief = async (req, res) => {
    try {
        const { id_brief, grupo } = req.params;

        const [costos, lineas, summaries] = await Promise.all([
            // Catálogo seleccionable: solo costos de plataformas activas. Una
            // plataforma nunca se borra (solo se desactiva, ver migración de la FK),
            // así que esto simplemente oculta las que el admin desactivó — las líneas
            // ya guardadas de una plataforma desactivada NO se pierden (ver abajo).
            md.costo_por.findAll({
                where: { grupo, activo: true },
                include: [{ model: md.plataformas, as: 'plataforma', attributes: ['id', 'plataforma', 'icono'], where: { activo: true }, required: true }],
                order: [['tipo', 'ASC'], ['nombre', 'ASC']],
            }),
            md.performance_branding.findAll({
                where: { id_brief, grupo },
                include: [{ model: md.plataformas, as: 'plataforma', attributes: ['id', 'plataforma'], required: false }],
                order: [['id_plataforma', 'ASC']],
            }),
            md.summary.findAll({ where: { id_brief, grupo } }),
        ]);

        const summaryByTipoAndCosto = new Map();
        summaries.forEach((s) => {
            summaryByTipoAndCosto.set(`${s.tipo}_${s.id_costo}`, s.summary_meses);
        });

        const lineasConSummary = lineas.map((linea) => ({
            ...linea.toJSON(),
            summary_meses: summaryByTipoAndCosto.get(`${linea.tipo}_${linea.id_costo}`) || null,
        }));

        res.status(200).json({ costos, lineas: lineasConSummary });
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la cotización: ${error.message}` });
    }
};

const saveBulk = async (req, res) => {
    const { id_brief, grupo, tipo, lineas } = req.body;

    if (!id_brief || !grupo || !tipo) {
        return res.status(400).json({ message: 'id_brief, grupo y tipo son obligatorios.' });
    }
    if (!Array.isArray(lineas)) {
        return res.status(400).json({ message: 'lineas debe ser un arreglo.' });
    }
    for (const linea of lineas) {
        if (!linea.id_plataforma || !linea.id_costo || !linea.nombre) {
            return res.status(400).json({ message: 'Cada línea requiere id_plataforma, id_costo y nombre.' });
        }
        const summaryMeses = linea.summary_meses;
        if (summaryMeses && Math.round(sumaSummaryMeses(summaryMeses)) !== 100) {
            return res.status(400).json({
                message: `La distribución de "${linea.nombre}" debe sumar 100% (suma actual: ${sumaSummaryMeses(summaryMeses)}%).`,
            });
        }
    }

    const t = await md.sequelize.transaction();
    try {
        await md.performance_branding.destroy({ where: { id_brief, grupo, tipo }, transaction: t });
        await md.summary.destroy({ where: { id_brief, grupo, tipo }, transaction: t });

        const now = new Date();
        const performanceBrandingRows = lineas.map((linea) => ({
            id_brief,
            grupo,
            tipo,
            id_plataforma: linea.id_plataforma,
            nombre: linea.nombre,
            id_costo: linea.id_costo,
            costo: linea.costo,
            inversion: linea.inversion || 0,
            objetivo: calcularObjetivo(tipo, linea.inversion, linea.costo),
            kpi_principal: linea.kpi_principal || 0,
            kpi_secundario: linea.kpi_secundario || 0,
            frecuencia: linea.frecuencia || 0,
            activo: true,
            usuario_creacion: req.user.id,
            fecha_creacion: now,
        }));

        const created = await md.performance_branding.bulkCreate(performanceBrandingRows, { transaction: t });

        const summaryRows = lineas.map((linea) => ({
            id_brief,
            grupo,
            tipo,
            id_costo: linea.id_costo,
            summary_meses: linea.summary_meses || defaultSummaryMeses(),
            usuario_creacion: req.user.id,
            fecha_creacion: now,
        }));

        if (summaryRows.length > 0) {
            await md.summary.bulkCreate(summaryRows, { transaction: t });
        }

        // Cualquier cambio en la cotización invalida el PDF ya generado (si existe).
        if (md.pdf_planificador) {
            await md.pdf_planificador.update(
                { activo: false },
                { where: { id_brief, activo: true }, transaction: t }
            );
        }

        await t.commit();
        res.status(200).json({ message: 'Cotización guardada correctamente', data: created });
    } catch (error) {
        await t.rollback();
        res.status(500).json({ message: `Error al guardar la cotización: ${error.message}` });
    }
};

module.exports = {
    getByBrief,
    saveBulk,
};
