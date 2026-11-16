const fetch = require('node-fetch');
const OpenAI = require('openai');
const { AiError } = require('./ai_error');

// Modelos por nivel: 'smart' para redactar respuestas, 'fast' para tareas cortas (extraer entidades, aclaraciones).
// Estos son los de respaldo: un superadmin los cambia en Configuraciones (`openai_model_smart` y `openai_model_fast`).
const DEFAULT_MODELS = { smart: 'gpt-4o', fast: 'gpt-4o-mini' };

// Los modelos de razonamiento (serie o3/o4, GPT-5 en adelante) piensan antes de responder y ese pensamiento cuenta dentro del
// tope de tokens: con `max_tokens` la API los rechaza (piden `max_completion_tokens`) y con un tope chico (150, 200...)
// gastan todo pensando y devuelven la respuesta vacía. Por eso a estos se les da holgura (REASONING_HEADROOM) sobre el tope pedido.
const isReasoningModel = (model) => /^(o\d|gpt-(5|[6-9]|\d{2,}))/i.test(model || '');
const REASONING_HEADROOM = 8000;

// Modelos que sirven para conversar por Chat Completions (lo que usa el asistente). Se excluyen los de audio, voz, imagen,
// búsqueda, código y los "pro" (solo funcionan por otra API), y las copias con fecha (2025-04-14...): queda un nombre por modelo.
// Es un filtro por nombre: no garantiza compatibilidad, por eso cada modelo se PRUEBA con una llamada real antes de guardarlo.
const isChatModelId = (id) =>
    /^(gpt-\d|o\d)/i.test(id)
    && !/(audio|realtime|transcribe|tts|image|search|codex|live|whisper|translate|diarize|instruct|moderation|embedding)/i.test(id)
    && !/-pro(-|$)/i.test(id)
    && !/-\d{4}-\d{2}-\d{2}$/.test(id);

// Traduce los errores del SDK de OpenAI a los códigos de AiError.
const mapError = (error) => {
    const status = error?.status;
    if (status === 401 || status === 403) return new AiError('AI_INVALID_KEY', { cause: error, provider: 'openai' });
    if (status === 429) {
        const quota = error?.code === 'insufficient_quota' || /quota|billing/i.test(error?.message || '');
        return new AiError(quota ? 'AI_NO_CREDIT' : 'AI_RATE_LIMIT', { cause: error, provider: 'openai' });
    }
    return new AiError('AI_UNAVAILABLE', { cause: error, provider: 'openai' });
};

// Modelo de cada nivel: el configurado y, si ese nivel no se configuró, el SUYO por defecto. Cada nivel es independiente: si solo
// se elige el modelo de las respuestas, las tareas cortas siguen con el modelo pequeño de siempre (no heredan el grande).
const resolveModel = (models, tier) => models?.[tier] || DEFAULT_MODELS[tier] || DEFAULT_MODELS.smart;

// Pedido a Chat Completions con los parámetros que cada familia de modelos acepta.
const buildRequest = ({ model, system, user, json, maxTokens }) => ({
    model,
    ...(json && { response_format: { type: 'json_object' } }),
    messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
    ],
    ...(maxTokens && (isReasoningModel(model)
        ? { max_completion_tokens: maxTokens + REASONING_HEADROOM }
        : { max_tokens: maxTokens })),
});

const create = (apiKey, models = {}) => {
    const client = new OpenAI({ apiKey, fetch });
    const modelFor = (tier) => resolveModel(models, tier);
    return {
        name: 'openai',
        async complete({ system, user, json = false, tier = 'smart', maxTokens }) {
            try {
                const response = await client.chat.completions.create(
                    buildRequest({ model: modelFor(tier), system, user, json, maxTokens }),
                );
                return response.choices[0].message.content;
            } catch (error) {
                throw mapError(error);
            }
        },
    };
};

// Modelos de chat que ofrece la cuenta de OpenAI de esa clave (el más nuevo primero).
const listModels = async (apiKey) => {
    const client = new OpenAI({ apiKey, fetch });
    try {
        const page = await client.models.list();
        return page.data
            .map((m) => m.id)
            .filter(isChatModelId)
            .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    } catch (error) {
        throw mapError(error);
    }
};

// Prueba REAL de un modelo con la misma forma de llamada que usa el asistente (mensaje de sistema + modo JSON). Gasta unos pocos
// tokens. Lanza el error de OpenAI tal cual (con `status` y `message`) para poder explicarle al usuario por qué no sirve.
const testModel = async (apiKey, model) => {
    const client = new OpenAI({ apiKey, fetch, timeout: 40000, maxRetries: 0 });
    const response = await client.chat.completions.create(buildRequest({
        model,
        system: 'Responde únicamente con un objeto JSON.',
        user: 'Devuelve {"ok": true}',
        json: true,
        maxTokens: 50,
    }));
    const text = response.choices?.[0]?.message?.content;
    if (!text || !text.trim()) throw new Error('El modelo respondió vacío.');
    return text;
};

module.exports = { create, listModels, testModel, isChatModelId, isReasoningModel, resolveModel, DEFAULT_MODELS };
