const { extractEntities } = require('./services/entityExtractor.service');
const { getNecesita } = require('./services/contextRouter');
const { getCatalog } = require('./services/catalogSearch.service');
const { generateClarification,
    generateNotFound } = require('./services/clarification.service');
const { interpretQuestion } = require('./services/interpreter.service');
const { generateResponse } = require('./services/responder.service');
const { executeTool } = require('./tools/executor');

async function handleChat(req, res) {
    try {
        const { pregunta, seleccion_id, seleccion_tipo } = req.body;

        if (!pregunta?.trim()) {
            return res.status(400).json({ error: 'La pregunta es requerida' });
        }

        // ── PASO 1: Extraer intención y entidades de la pregunta ──
        const entidades = await extractEntities(pregunta);

        // ── PASO 2: Si el empleado ya seleccionó de una lista ──
        // (segunda vuelta tras una aclaración)
        if (seleccion_id) {
            const datos = await executeTool([{
                herramienta: getToolByTipo(seleccion_tipo, entidades.intencion),
                parametros: { campana_id: seleccion_id }
            }]);
            const respuesta = await generateResponse(pregunta, datos);
            return res.json({ tipo: 'respuesta', mensaje: respuesta });
        }

        // ── PASO 3: Saber qué contexto necesita esta intención ──
        const necesita = getNecesita(entidades.intencion);

        // ── PASO 4: Buscar contexto en BD solo si hace falta ──
        let catalogo = { empresa: null, campanas: [] };

        if (necesita.length > 0) {
            catalogo = await getCatalog(entidades, necesita);

            // Ambigüedad — el empleado necesita elegir
            if (catalogo.ambiguo) {
                const mensaje = await generateClarification({
                    pregunta,
                    opciones: catalogo.opciones,
                    tipo_ambiguo: catalogo.tipo_ambiguo
                });
                return res.json({
                    tipo: 'aclaracion',
                    mensaje,
                    // El frontend usa este array para armar los botones
                    opciones: catalogo.opciones
                });
            }

            // Sin resultados
            if (catalogo.sin_resultados || catalogo.sin_empresa) {
                const mensaje = await generateNotFound({
                    pregunta,
                    entidades,
                    tipo_no_encontrado: catalogo.tipo_no_encontrado || 'empresa'
                });
                return res.json({ tipo: 'no_encontrado', mensaje });
            }
        }

        // ── PASO 5: La IA elige qué herramienta usar ──
        const interpretacion = await interpretQuestion(
            pregunta,
            catalogo,
            entidades.intencion
        );

        if (interpretacion.tipo === 'respuesta_directa') {
            return res.json({ tipo: 'respuesta', mensaje: interpretacion.mensaje });
        }

        // ── PASO 6: Ejecutar la herramienta elegida ──
        const datos = await executeTool(interpretacion.calls);

        // ── PASO 7: La IA redacta la respuesta final ──
        const respuesta = await generateResponse(pregunta, datos);
        return res.json({ tipo: 'respuesta', mensaje: respuesta });

    } catch (error) {
        console.error('Error en chat:', error);
        res.status(500).json({ error: 'Error procesando la consulta' });
    }
}

// Mapea la intención al tool correcto cuando viene seleccion_id
function getToolByTipo(seleccion_tipo, intencion) {
    if (seleccion_tipo === 'empresa') return 'get_client_summary';
    const mapaIntencion = {
        'estado_campana': 'get_campaign_status',
        'datos_diarios': 'get_daily_data',
        'proyeccion': 'get_projection',
        'reporte_completo': 'generate_campaign_report'
    };
    return mapaIntencion[intencion] || 'get_campaign_status';
}

module.exports = { handleChat };