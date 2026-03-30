const openai = require('./openai.service');

// Redacta el mensaje de aclaración cuando hay ambigüedad
async function generateClarification({ question, options, ambiguous_type }) {
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
                content: `Pregunta original: "${question}"
                    Tipo de ambigüedad: ${ambiguous_type}
                    Opciones encontradas: ${JSON.stringify(options.map(o => o.label))}`
            }
        ],
        max_tokens: 150
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed.mensaje;
}

// Redacta el mensaje cuando no se encuentra nada
async function generateNotFound({ question, entities, not_found_type }) {
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
        Responde en formato JSON SOLO con: { "mensaje": "..." }`
            },
            {
                role: 'user',
                content: `Pregunta del empleado: "${question}"
  
                        El sistema buscó una ${not_found_type} y no encontró resultados.
                    ${not_found_type === 'company'
                        ? `No existe ninguna empresa/cliente con el nombre "${entities.company_name}" en el sistema.`
                        : `No se encontraron campañas con el nombre "${entities.campaign_name}" en el sistema.`
                    }
  
                    Informa esto claramente al empleado y sugiere verificar o añadir el dato correcto.`
            }
        ],
        max_tokens: 150
    });

    const parsed = JSON.parse(response.choices[0].message.content);
    return parsed.mensaje;
}

module.exports = { generateClarification, generateNotFound };