const md = require('../models');
const { resetAICache, getActiveProvider, MODULE: AI_MODULE } = require('../assistant_ai/providers');
const { AiError } = require('../assistant_ai/providers/ai_error');

// ---- Modelos de la IA del asistente (equipo y cliente) -------------------------------------------------------------
// `<proveedor>_model_smart` = modelo de las respuestas completas; `<proveedor>_model_fast` = modelo de las tareas cortas
// (entender la pregunta, aclaraciones). Se cambian aquí y valen desde la siguiente pregunta. Antes de guardar, el modelo se
// PRUEBA con una llamada real mínima: así nadie deja al asistente roto con un modelo que no existe o que no sirve para chatear.
const MODEL_KEY_RE = /^[a-z]+_model_(smart|fast)$/;
const isModelSetting = (module, key) => module === AI_MODULE && MODEL_KEY_RE.test(String(key || ''));

// Explica en español, y sin términos técnicos, por qué OpenAI no aceptó el modelo.
const explainModelError = (model, error) => {
    const status = error?.status;
    const detail = String(error?.message || '');
    if (status === 404 || /does not exist|not found|do not have access/i.test(detail)) {
        return `El modelo "${model}" no existe o su cuenta de OpenAI no tiene acceso a él. Elija uno de la lista.`;
    }
    if (status === 400) {
        return `El modelo "${model}" no es compatible con el chat del asistente. Elija otro de la lista.`;
    }
    if (status === 401 || status === 403) return 'La API key de la IA no es válida: actualícela antes de cambiar el modelo.';
    if (status === 429) return 'La cuenta de la IA no tiene saldo o alcanzó su límite de uso: no se pudo probar el modelo.';
    if (/timeout|timed out|ETIMEDOUT|aborted/i.test(`${detail} ${error?.name}`)) {
        return `El modelo "${model}" tardó demasiado en responder la prueba. Pruebe con otro o intente de nuevo.`;
    }
    return `No se pudo probar el modelo "${model}": ${detail || 'error desconocido'}.`;
};

// Devuelve un mensaje de error si el modelo no sirve, o null si pasó la prueba.
const checkModel = async (value) => {
    const model = typeof value === 'string' ? value.trim() : '';
    if (!model || model.length > 100 || !/^[\w.:-]+$/.test(model)) return 'El nombre del modelo no es válido.';
    let provider;
    try {
        provider = await getActiveProvider();
    } catch (error) {
        if (error instanceof AiError) return 'Primero configure la API key de la IA: sin ella no se puede probar el modelo.';
        throw error;
    }
    try {
        await provider.module.testModel(provider.apiKey, model);
        return null;
    } catch (error) {
        return explainModelError(model, error);
    }
};

// GET /system_settings/ai_models — modelos de chat de la cuenta de la IA y los que están en uso (solo superadmin).
const getAiModels = async (req, res) => {
    try {
        const provider = await getActiveProvider();
        const models = await provider.module.listModels(provider.apiKey);
        const current = {};
        for (const tier of ['smart', 'fast']) {
            const row = await md.system_settings.findOne({ where: { module: AI_MODULE, key: `${provider.name}_model_${tier}`, active: true } });
            current[tier] = (typeof row?.value === 'string' && row.value.trim()) || provider.module.DEFAULT_MODELS?.[tier] || null;
        }
        res.json({ provider: provider.name, models, current, defaults: provider.module.DEFAULT_MODELS || {} });
    } catch (error) {
        if (error instanceof AiError) {
            return res.status(error.code === 'AI_NOT_CONFIGURED' ? 400 : 502).json({ error: error.message });
        }
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
};

const getAll = async (req, res) => {
    try {
        const { module } = req.query;
        const where = {};
        if (module) where.module = module;
        const settings = await md.system_settings.findAll({
            where,
            order: [['module', 'ASC'], ['key', 'ASC']],
        });
        res.json(settings);
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const getById = async (req, res) => {
    try {
        const { id } = req.params;
        const setting = await md.system_settings.findByPk(id);
        if (!setting) {
            return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        res.json(setting);
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const create = async (req, res) => {
    try {
        const { module, key, value, description, active } = req.body;
        if (!module || !key || value === undefined) {
            return res
                .status(400)
                .json({ error: 'module, key y value son requeridos' });
        }
        if (isModelSetting(module, key) && (active ?? true)) {
            const problem = await checkModel(value);
            if (problem) return res.status(400).json({ error: problem });
        }
        const newSetting = await md.system_settings.create({
            module,
            key,
            value,
            description,
            active: active ?? true,
        });
        if (module === AI_MODULE) resetAICache();
        res.status(201).json(newSetting);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res
                .status(409)
                .json({ error: 'Ya existe una configuración con ese module y key' });
        }
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const update = async (req, res) => {
    try {
        const { id } = req.params;
        const setting = await md.system_settings.findByPk(id);
        if (!setting) {
            return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        const { module, key, value, description, active } = req.body;
        const payload = { updated_at: new Date() };
        if (module !== undefined) payload.module = module;
        if (key !== undefined) payload.key = key;
        if (value !== undefined) payload.value = value;
        if (description !== undefined) payload.description = description;
        if (active !== undefined) payload.active = active;
        // Un modelo de IA se prueba antes de guardarlo (solo si cambia el modelo o se reactiva).
        const finalModule = payload.module ?? setting.module;
        const finalKey = payload.key ?? setting.key;
        const finalValue = payload.value ?? setting.value;
        const finalActive = payload.active ?? setting.active;
        const modelChanged = finalValue !== setting.value || finalKey !== setting.key || (finalActive && !setting.active);
        if (isModelSetting(finalModule, finalKey) && finalActive && modelChanged) {
            const problem = await checkModel(finalValue);
            if (problem) return res.status(400).json({ error: problem });
        }
        const touchesAI = setting.module === AI_MODULE || finalModule === AI_MODULE;
        await setting.update(payload);
        if (touchesAI) resetAICache();
        res.json(setting);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res
                .status(409)
                .json({ error: 'Ya existe una configuración con ese module y key' });
        }
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

const remove = async (req, res) => {
    try {
        const { id } = req.params;
        const setting = await md.system_settings.findByPk(id);
        if (!setting) {
            return res.status(404).json({ error: 'Configuración no encontrada' });
        }
        const wasAI = setting.module === AI_MODULE;
        await setting.destroy();
        if (wasAI) resetAICache();
        res.json({ message: 'Configuración eliminada correctamente' });
    } catch (error) {
        res.status(500).json({
            error: 'Error interno del servidor: ' + error.message,
        });
    }
};

module.exports = {
    getAiModels,
    getAll,
    getById,
    create,
    update,
    remove,
};
