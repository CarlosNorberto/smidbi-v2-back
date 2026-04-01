const openai = require('./openai.service');

const generateResponse = async (question, data, fromSelection = false) => {

    const isOutOfScope = Object.values(data).some(d => d?.out_of_scope === true);

    if (isOutOfScope) {
        // Llamada barata con gpt-4o-mini solo para redactar el mensaje
        const response = await openai.chat.completions.create({
            model: 'gpt-4o-mini',
            response_format: { type: 'json_object' },
            messages: [
                {
                    role: 'system',
                    content: `Eres un asistente interno de una agencia de marketing digital.
                        El usuario hizo una pregunta que está fuera del alcance del sistema.
                        El sistema solo puede responder sobre: campañas, clientes, reportes, 
                        KPIs, presupuestos y usuarios del sistema.

                        Redacta un mensaje amigable explicando esto y sugiere qué tipo de 
                        preguntas sí puede responder.
                        Responde en formato JSON SOLO con: { "message": "..." }`
                },
                {
                    role: 'user',
                    content: `Pregunta fuera de scope: "${question}"`
                }
            ],
            max_tokens: 200
        });

        const parsed = JSON.parse(response.choices[0].message.content);
        return parsed.message;
    }

    const flatData = Object.values(data)[0] || data;
    const linkToReport = flatData?.link_to_report || null;

    // Flujo normal si no es out_of_scope
    const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
            {
                role: 'system',
                content: `Eres un asistente interno de una agencia de marketing digital.
                    Responde de forma clara, profesional y concisa en español.
                    Usa los datos proporcionados para responder con precisión.
                    Si algo merece atención o alerta, menciónalo.
                    SOLO responde sobre temas de campañas y marketing digital.

                    # REGLAS:

                    1. TÍTULO:
                        Si los datos incluyen "campaign_name" o "nombre" de la campaña, úsalo como título de tu respuesta.

                    2. NOMBRES:
                        Usa SIEMPRE el nombre exacto del campo "campaign_name" en los datos.
                        NUNCA abrevies ni modifiques el nombre.

                    3. DATOS DIARIOS:
                        - Más de 7 días: NO listes todos. Muestra solo total, promedio, mejor día y peor día.
                        - El día actual en 0 es normal, ignóralo.
                        - Días anteriores en 0 sí son una alerta.
                        - 7 días o menos: puedes listarlos.

                    4. TÉRMINOS TÉCNICOS:
                        - NUNCA menciones nombres de campos como: days_remaining, kpi_progress, 
                            time_progress, gap, out_of_scope, campaign_id, company_id
                        - Tradúcelos a lenguaje natural:
                            days_remaining → "días restantes"
                            vence_hoy: true → "vence hoy"
                            status: "behind" → "está por debajo de su meta"
                            status: "on_track" → "va bien"
                            status: "at_risk" → "está en riesgo"
                    
                    5. CAMPAÑAS POR VENCER:
                        Cuando respondas sobre campañas por vencer:
                        - SIEMPRE muestra el listado agrupado por empresa
                        - Formato por empresa:
                            **Nombre Empresa** (N campañas)
                            - Campaña 1 — vence hoy/en N días
                            - Campaña 2 — vence hoy/en N días
                        - Al final muestra el total general
                        - NO omitas ninguna empresa del listado

                    ${fromSelection
                    && `6. SELECCIÓN DE CAMPAÑA:
                            El usuario seleccionó esta campaña de una lista de opciones.
                            Responde directamente con los datos de la campaña.
                            NUNCA menciones si el nombre coincide o no con la búsqueda original.
                            NUNCA uses frases como "no coincide exactamente" o "mencionas".`
                    }

                    No ofrezcas información adicional, solo responde con lo que se te dio y lo que se te preguntó. Si no tienes suficiente información, dilo claramente.
                    `
            },
            {
                role: 'user',
                content: `Pregunta: "${question}"
                    Datos: ${JSON.stringify(flatData, null, 2)}`
            }
        ],
        max_tokens: 1000
    });

    let aiResponse = response.choices[0].message.content;

    // if (linkToReport) {
    //     aiResponse += `\n\nPuedes ver el reporte completo aquí: ${linkToReport}`;
    // }

    return aiResponse;
}

module.exports = generateResponse;