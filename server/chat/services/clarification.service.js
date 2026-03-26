const openai = require('./openai.service');

// Redacta el mensaje de aclaración cuando hay ambigüedad
async function generateClarification({ pregunta, opciones, tipo_ambiguo }) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `Eres un asistente interno de una agencia de marketing digital.
        El sistema encontró múltiples resultados para la consulta.
        Redacta un mensaje corto y amigable pidiendo al empleado que especifique cuál necesita.
        Responde SOLO con un JSON así: { "mensaje": "..." }`
            },
            {
                role: 'user',
                content: `Pregunta original: "${pregunta}"
        Tipo de ambigüedad: ${tipo_ambiguo}
        Opciones encontradas: ${JSON.stringify(opciones.map(o => o.label))}`
            }
        ],
        max_tokens: 150
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed.mensaje;
}

// Redacta el mensaje cuando no se encuentra nada
async function generateNotFound({ pregunta, entidades, tipo_no_encontrado }) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `Eres un asistente interno de una agencia de marketing digital.
        No se encontró información en el sistema para la consulta del empleado.
        Redacta un mensaje corto y amigable informando esto.
        Sugiere verificar el nombre o los filtros usados.
        Responde SOLO con: { "mensaje": "..." }`
            },
            {
                role: 'user',
                content: `Pregunta: "${pregunta}"
        No se encontró: ${tipo_no_encontrado}
        Entidades buscadas: ${JSON.stringify(entidades)}`
            }
        ],
        max_tokens: 150
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed.mensaje;
}

module.exports = { generateClarification, generateNotFound };