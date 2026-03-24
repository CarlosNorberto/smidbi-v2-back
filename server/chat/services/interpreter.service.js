const openai = require('./openai.service');
const toolDefinitions = require('../tools/index');

async function interpretQuestion(pregunta, catalogo) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `Eres un intérprete de intenciones para un sistema interno 
        de una agencia de marketing digital.
        
        Tienes acceso al siguiente catálogo de clientes y campañas activas:
        ${JSON.stringify(catalogo)}
        
        Usa las herramientas disponibles para responder la pregunta del empleado.
        Resuelve siempre los nombres a IDs usando el catálogo.
        Si hay ambigüedad, elige la opción más probable según el contexto.
        La fecha de hoy es: ${new Date().toISOString().split('T')[0]}
        FORMATO DE RESPUESTA:
            - Responde siempre en formato Markdown.
            - Usa ## para secciones principales.
            - Usa **negrita** para valores numéricos y métricas importantes.
            - Usa listas con - para enumerar métricas.
            - Sé conciso y directo.`
            },
            {
                role: "user",
                content: pregunta
            }
        ],
        tools: toolDefinitions,
        tool_choice: "auto"
    });

    const message = response.choices[0].message;

    // La IA eligió una herramienta
    if (message.tool_calls && message.tool_calls.length > 0) {
        return {
            tipo: "tool_call",
            calls: message.tool_calls.map(tc => ({
                herramienta: tc.function.name,
                parametros: JSON.parse(tc.function.arguments)
            }))
        };
    }

    // La IA respondió directo (pregunta fuera de scope)
    return {
        tipo: "direct_response",
        mensaje: message.content
    };
}

module.exports = { interpretQuestion };