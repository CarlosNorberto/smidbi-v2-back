const fetch = require('node-fetch');
const OpenAI = require('openai');
const { AiError } = require('./ai_error');

// Modelos por nivel: 'smart' para redactar respuestas, 'fast' para tareas cortas (extraer entidades, aclaraciones).
const MODELS = { smart: 'gpt-4o', fast: 'gpt-4o-mini' };

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

const create = (apiKey) => {
    const client = new OpenAI({ apiKey, fetch });
    return {
        name: 'openai',
        async complete({ system, user, json = false, tier = 'smart', maxTokens }) {
            try {
                const response = await client.chat.completions.create({
                    model: MODELS[tier] ?? MODELS.smart,
                    ...(json && { response_format: { type: 'json_object' } }),
                    messages: [
                        { role: 'system', content: system },
                        { role: 'user', content: user },
                    ],
                    ...(maxTokens && { max_tokens: maxTokens }),
                });
                return response.choices[0].message.content;
            } catch (error) {
                throw mapError(error);
            }
        },
    };
};

module.exports = { create };
