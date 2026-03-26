const openai = require('./openai.service');

async function generateResponse(pregunta, datos) {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: `Eres un asistente interno de una agencia de marketing digital.
        Responde de forma clara, profesional y concisa en español.
        Usa los datos proporcionados para responder con precisión.
        Si algo merece atención o alerta, menciónalo.
        SOLO responde sobre temas de campañas y marketing digital.`
            },
            {
                role: 'user',
                content: `Pregunta: "${pregunta}"
        Datos: ${JSON.stringify(datos, null, 2)}`
            }
        ],
        max_tokens: 1000
    });

    return response.choices[0].message.content;
}

module.exports = { generateResponse };