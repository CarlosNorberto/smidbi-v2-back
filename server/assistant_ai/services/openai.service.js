const fetch = require('node-fetch')
const OpenAI = require('openai');
const md = require('../../models');

// La API key vive en `system_settings` (module: 'assistant_ai', key:
// 'openai_api_key') para poder cambiarla desde Configuraciones sin redeploy.
// Se cachea unos minutos para no consultar la BD en cada mensaje del chat.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = { client: null, apiKey: null, at: 0 };

const resolveApiKey = async () => {
    try {
        const setting = await md.system_settings.findOne({
            where: { module: 'assistant_ai', key: 'openai_api_key', active: true },
        });
        if (setting?.value) return setting.value;
    } catch {
        // Si la consulta falla (ej. BD no disponible), se usa el fallback de abajo.
    }
    return process.env.OPENAI_API_KEY;
};

const getOpenAIClient = async () => {
    const now = Date.now();
    if (cache.client && (now - cache.at) < CACHE_TTL_MS) {
        return cache.client;
    }
    const apiKey = await resolveApiKey();
    if (apiKey !== cache.apiKey || !cache.client) {
        cache.client = new OpenAI({ apiKey, fetch });
        cache.apiKey = apiKey;
    }
    cache.at = now;
    return cache.client;
};

module.exports = { getOpenAIClient };
