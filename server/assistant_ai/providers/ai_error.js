const { logEvent } = require('../../services/systemEventService');
const { notifyRoles } = require('../../services/notificationService');

// Error unificado de la capa de IA: cada proveedor (OpenAI, Claude, Gemini...) traduce sus fallos a estos códigos,
// así los controladores muestran el mismo mensaje sin importar con qué IA se esté trabajando.
//   internalMessage  claro y accionable, para el personal interno (y el log)
//   clientMessage    amable y sin detalles técnicos, para el cliente final
const CODES = {
    AI_NOT_CONFIGURED: {
        status: 503,
        internalMessage: "Falta configurar la API key de la IA: créela en Configuraciones > Generales.",
    },
    AI_INVALID_KEY: {
        status: 503,
        internalMessage: 'La API key de la IA no es válida o fue revocada: actualícela en Configuraciones > Generales.',
    },
    AI_NO_CREDIT: {
        status: 503,
        internalMessage: 'Se agotó el crédito de la cuenta de la IA: recargue el saldo en el panel del proveedor.',
    },
    AI_RATE_LIMIT: {
        status: 429,
        internalMessage: 'La IA recibió demasiadas solicitudes seguidas (límite de uso): intente de nuevo en un momento.',
    },
    AI_UNAVAILABLE: {
        status: 503,
        internalMessage: 'El servicio de la IA no está disponible en este momento: intente de nuevo en unos minutos.',
    },
};

// Fallos que requieren una acción de un administrador: se avisan en la campanita (grupo "Otros"). Los pasajeros
// (límite de uso, servicio caído) solo se registran en el log.
const ADMIN_NOTICES = {
    AI_NO_CREDIT: {
        title: 'Se agotó el crédito de la IA',
        body: 'El asistente IA dejó de responder. Recargue el saldo en el panel del proveedor.',
        link: null,
    },
    AI_INVALID_KEY: {
        title: 'La API key de la IA no es válida',
        body: 'El asistente IA dejó de responder. Actualice la clave en Configuraciones > Generales.',
        link: '/admin/system_settings',
    },
    AI_NOT_CONFIGURED: {
        title: 'Falta configurar la IA',
        body: 'El asistente IA no puede responder: falta la API key en Configuraciones > Generales.',
        link: '/admin/system_settings',
    },
};

const CLIENT_MESSAGE = 'El asistente no está disponible por el momento. Por favor, intente nuevamente más tarde.';

class AiError extends Error {
    constructor(code, { cause, provider } = {}) {
        const def = CODES[code] ?? CODES.AI_UNAVAILABLE;
        super(def.internalMessage);
        this.name = 'AiError';
        this.code = CODES[code] ? code : 'AI_UNAVAILABLE';
        this.status = def.status;
        this.provider = provider ?? null;
        this.cause = cause;
        this.clientMessage = CLIENT_MESSAGE;
    }
}

// Responde con el mensaje correcto según quién consulta. `audience`: 'client' | 'internal'.
// Si el error no es de la IA (un bug, la base de datos...), devuelve `fallback` con 500.
const respondWithError = (res, error, { audience, fallback }) => {
    // El detalle técnico va al registro de errores (Configuraciones > Registro de errores, solo superadmin).
    res.locals.eventLogged = true;
    logEvent({
        category: 'asistente_ia',
        source: error instanceof AiError ? `${error.provider ?? 'ia'} · ${error.code}` : (audience === 'client' ? 'cliente' : 'interno'),
        message: error.message,
        detail: error instanceof AiError
            ? { code: error.code, provider: error.provider, status: error.cause?.status ?? null, original: error.cause?.message ?? null }
            : null,
        error: error instanceof AiError ? null : error,
        req: res.req,
        statusCode: error instanceof AiError ? error.status : 500,
    });
    if (error instanceof AiError && ADMIN_NOTICES[error.code]) {
        notifyRoles(['admin', 'superadmin'], { type: `ai_${error.code}`, ...ADMIN_NOTICES[error.code] });
    }
    if (error instanceof AiError) {
        const message = audience === 'client' ? error.clientMessage : error.message;
        return res.status(error.status).json({ message, code: error.code });
    }
    return res.status(500).json({ message: fallback });
};

module.exports = { AiError, respondWithError };
