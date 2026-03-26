const openai = require('./openai.service');
const toolDefinitions = require('../tools/index');

async function interpretQuestion(pregunta, catalogo, intencion) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: `Eres un intérprete de intenciones para un sistema de marketing digital.
        Intención detectada: ${intencion}
        Contexto disponible: ${JSON.stringify(catalogo)}
        Fecha de hoy: ${new Date().toISOString().split('T')[0]}
        Usa las herramientas disponibles para resolver la consulta.
        SOLO responde sobre temas de campañas y marketing digital.`
            },
            {
                role: 'user',
                content: pregunta
            }
        ],
        tools: toolDefinitions,
        tool_choice: 'auto'
    });

    const message = response.choices[0].message;

    if (message.tool_calls?.length > 0) {
        return {
            tipo: 'tool_call',
            calls: message.tool_calls.map(tc => ({
                herramienta: tc.function.name,
                parametros: JSON.parse(tc.function.arguments)
            }))
        };
    }

    return {
        tipo: 'respuesta_directa',
        mensaje: message.content
    };
}

module.exports = { interpretQuestion };