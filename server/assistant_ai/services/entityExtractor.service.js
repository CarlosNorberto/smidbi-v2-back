const openai = require('./openai.service');
const { getIntentNames, getIntentDescriptions } = require('../config/intents');

const extractEntities = async (question) => {
    const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        response_format: { type: 'json_object' },
        messages: [
            {
                role: 'system',
                content: `Eres un extractor de entidades para un sistema interno
                    de una agencia de marketing digital.

                    Tu tarea tiene DOS partes:

                    ## PARTE 1 - Extrae estas entidades del texto:
                    - company_name: nombre de la empresa/cliente (string o null)
                        IMPORTANTE: una empresa es el cliente contratante del servicio de marketing.
                        NO confundir con el nombre de una campaña publicitaria.
                        Si no estás seguro si es empresa o campaña, deja este campo en null.
                    - campaign_name: nombre COMPLETO de la campaña o reporte tal como aparece en la pregunta (string o null)
                        Extrae SOLO el nombre propio de la campaña.
                        Elimina únicamente palabras funcionales de la pregunta, NO nombres propios:
                        Palabras a eliminar: "informe", "reporte", "datos", "estado", "resumen", 
                        "completo", "campaña", "de la campaña", "del cliente", "dame", "genera", 
                        "muéstrame", "cómo va", "cuál es", "el avance de"
                        Los nombres propios, marcas o palabras en mayúsculas forman parte del nombre 
                        de la campaña y NUNCA deben eliminarse.
                        Nunca partas un nombre de campaña en dos campos distintos.
                    - platform: Facebook, Instagram, Google, TikTok, YouTube (string o null)
                    - period: referencia de tiempo mencionada (string o null)
                    - year: año mencionado EXPLÍCITAMENTE como número entero (number o null)
                        SOLO extrae el año si aparece literalmente en la pregunta como número (ej: 2025, 2026).
                        "fin de mes", "esta semana", "este mes" NO son años, dejar en null.
                    - start_date: fecha inicio inferida en YYYY-MM-DD (string o null)
                    - end_date: fecha fin inferida en YYYY-MM-DD (string o null)
                    - days_ahead: número de días hacia adelante para buscar campañas por vencer (number)
                      Reglas:
                      - "esta semana" o sin periodo → 7
                      - "hoy" → 0
                      - "este mes" → 30
                      - "en 2 días" → 2
                      - "en 3 días" → 3
                      - "los próximos N días" → N
                      - Si no se menciona periodo → 7

                    ## PARTE 2 - Identifica la intención:
                    La intención principal. Elige según descripción y palabras clave de:

                    - intent: ${getIntentDescriptions()}

                    REGLA CRÍTICA: Si la pregunta contiene un campaign_name o company_name,
                    NUNCA uses "unknown" como intent, aunque el nombre parezca genérico o 
                    no relacionado con marketing.
                    "unknown" es EXCLUSIVO para preguntas que NO contienen ningún nombre 
                    de campaña o empresa Y cuyo tema es completamente ajeno al marketing digital.

                    Responde SOLO con el JSON, sin explicación.`
            },
            {
                role: 'user',
                content: question
            }
        ],
        max_tokens: 200
    });

    try {
        const raw = response.choices[0].message.content;
        const parsed = JSON.parse(raw.replace(/```json|```/g, '').trim());

        return {
            company_name: parsed.company_name || null,
            campaign_name: parsed.campaign_name || null,
            platform: parsed.platform || null,
            period: parsed.period || null,
            year: parsed.year || null,
            start_date: parsed.start_date || null,
            end_date: parsed.end_date || null,
            days_ahead: parsed.days_ahead ?? 7,
            intent: getIntentNames().includes(parsed.intent)
                ? parsed.intent
                : 'campaign_status'
        };
    } catch {
        return {
            company_name: null,
            campaign_name: null,
            platform: null,
            year: null,
            start_date: null,
            end_date: null,
            intent: 'campaign_status'
        };
    }
}

module.exports = extractEntities;