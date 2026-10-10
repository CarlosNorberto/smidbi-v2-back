// Procesos del sistema que pueden enviar avisos por WhatsApp. En Administración > Configuraciones >
// "Notificaciones WhatsApp" se elige, para cada número, a qué procesos está suscrito.
// Para sumar un proceso nuevo basta con agregarlo acá (key estable, sin espacios, + etiqueta legible);
// el frontend toma esta lista del endpoint /whatsapp_destinatarios/procesos.
const PROCESOS = [
    {
        key: 'nuevo_brief',
        label: 'Nuevo brief recibido',
        description: 'Cuando un cliente envía el formulario público de brief.',
    },
    {
        key: 'propuesta_respuesta',
        label: 'Respuesta a una propuesta',
        description: 'Cuando un cliente acepta o rechaza la propuesta del planificador.',
    },
];

const PROCESOS_KEYS = PROCESOS.map((p) => p.key);

module.exports = { PROCESOS, PROCESOS_KEYS };
