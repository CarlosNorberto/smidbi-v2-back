const md = require('../../models');
const { AiError } = require('./ai_error');

// Capa aislada de conexión con la IA. El resto del asistente solo conoce:
//
//   const ai = await getAI();
//   const text = await ai.complete({ system, user, json, tier, maxTokens });
//
//   tier: 'smart' (respuestas completas) | 'fast' (tareas cortas y baratas). Cada proveedor lo traduce a su modelo.
//   json: true pide una respuesta JSON válida.
//   Los fallos llegan siempre como AiError (sin crédito, clave inválida, límite, no disponible), sea cual sea el proveedor.
//
// Para sumar un proveedor (Claude, Gemini...): crear providers/<nombre>.provider.js con `create(apiKey)` que devuelva
// { name, complete }, traducir sus errores a AiError, registrarlo en PROVIDERS y en KNOWN_SETTINGS del frontend
// (system_settings_page.jsx). Cada proveedor tiene su propia clave en Configuraciones: <nombre>_api_key.
//
// Configuración (system_settings, módulo 'assistant_ai'):
//   provider        proveedor activo (por defecto 'openai')
//   <proveedor>_api_key   clave del proveedor (openai_api_key, ...)
const PROVIDERS = {
    openai: require('./openai.provider'),
};
const DEFAULT_PROVIDER = 'openai';
const MODULE = 'assistant_ai';

// Se cachea unos minutos para no consultar la BD en cada mensaje del chat.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = { ai: null, provider: null, apiKey: null, at: 0 };

const readSetting = async (key) => {
    const setting = await md.system_settings.findOne({ where: { module: MODULE, key, active: true } });
    return typeof setting?.value === 'string' ? setting.value.trim() : '';
};

const getAI = async () => {
    const now = Date.now();
    if (cache.ai && now - cache.at < CACHE_TTL_MS) return cache.ai;

    const provider = (await readSetting('provider')) || DEFAULT_PROVIDER;
    if (!PROVIDERS[provider]) {
        throw new AiError('AI_NOT_CONFIGURED', { provider });
    }
    const apiKey = await readSetting(`${provider}_api_key`);
    if (!apiKey) throw new AiError('AI_NOT_CONFIGURED', { provider });

    if (!cache.ai || provider !== cache.provider || apiKey !== cache.apiKey) {
        cache.ai = PROVIDERS[provider].create(apiKey);
        cache.provider = provider;
        cache.apiKey = apiKey;
    }
    cache.at = now;
    return cache.ai;
};

module.exports = { getAI, PROVIDER_NAMES: Object.keys(PROVIDERS) };
