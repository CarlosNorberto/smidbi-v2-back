const openai = require('./openai.service');

async function generateResponse(preguntaOriginal, datosRecopilados) {
    const response = await openai.chat.completions.create({
        model: "gpt-4o",
        messages: [
            {
                role: "system",
                content: `Eres un asistente interno de una agencia de marketing digital.
        Responde de forma clara, profesional y concisa.
        Usa los datos proporcionados para responder con precisión.
        Si algo merece atención o alerta, menciónalo.
        Responde siempre en español.
        IMPORTANTE: Solo responde sobre temas de campañas y marketing digital.
        Si te preguntan algo fuera de ese scope, redirige amablemente.`
            },
            {
                role: "user",
                content: `Pregunta del empleado: "${preguntaOriginal}"
        
        Datos disponibles:
        ${JSON.stringify(datosRecopilados, null, 2)}`
            }
        ],
        max_tokens: 1000
    });

    return response.choices[0].message.content;
}

module.exports = { generateResponse };