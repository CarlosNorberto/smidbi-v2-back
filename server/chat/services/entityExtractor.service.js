const openai = require('./openai.service');

const INTENCIONES = [
    'estado_campana',
    'datos_diarios',
    'proyeccion',
    'reporte_completo',
    'resumen_cliente',
    'campanas_activas',
    'campanas_con_problemas',
    'campanas_por_vencer',
    'listado_usuarios',
    'presupuesto_global'
];

async function extractEntities(pregunta) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `Eres un extractor de entidades para un sistema interno
                    de una agencia de marketing digital.
                    Analiza la pregunta y devuelve SOLO un JSON con estos campos:
                    
                    - nombre_empresa: nombre del cliente/empresa (string o null)
                    - nombre_campana: nombre de la campaña o reporte (string o null)
                    - plataforma: Facebook, Instagram, Google, TikTok, YouTube (string o null)
                    - anio: año mencionado como número entero (number o null)
                        Ejemplos: "gestión 2025" → 2025, "del 2026" → 2026, "este año" → año actual
                    - fecha_inicio: fecha de inicio del período consultado en formato YYYY-MM-DD (string o null)
                        Solo para consultas de datos diarios:
                        - "esta semana"   → lunes de la semana actual
                        - "este mes"      → primer día del mes actual
                        - "el último mes" → primer día del mes anterior
                        - "enero 2026"    → "2026-01-01"
                        - Si solo menciona año o gestión → null

                    - fecha_final: fecha de fin del período consultado en formato YYYY-MM-DD (string o null)
                        Solo para consultas de datos diarios:
                        - "esta semana"   → hoy
                        - "este mes"      → hoy
                        - "el último mes" → último día del mes anterior
                        - "enero 2026"    → "2026-01-31"
                        - Si solo menciona año o gestión → null

                    - intencion: UNA de estas exactas: ${INTENCIONES.join(', ')}

                    Si no identificas una entidad con certeza usa null.
                    Si la intención no encaja usa "estado_campana" como fallback.`
            },
            {
                role: 'user',
                content: pregunta
            }
        ],
        max_tokens: 200
    });

    try {
        const raw = response.choices[0].message.content;
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

        return {
            nombre_empresa: parsed.nombre_empresa || null,
            nombre_campana: parsed.nombre_campana || null,
            plataforma: parsed.plataforma || null,
            anio: parsed.anio || null,
            fecha_inicio: parsed.fecha_inicio || null,
            fecha_final: parsed.fecha_final || null,
            intencion: INTENCIONES.includes(parsed.intencion)
                ? parsed.intencion
                : 'estado_campana'
        };
    } catch {
        return {
            nombre_empresa: null,
            nombre_campana: null,
            plataforma: null,
            anio: null,
            fecha_inicio: null,
            fecha_final: null,
            intencion: 'estado_campana'
        };
    }
}

module.exports = { extractEntities, INTENCIONES };