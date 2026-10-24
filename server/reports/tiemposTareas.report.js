const { Op } = require('sequelize');
const moment = require('moment-timezone');
const md = require('../models');

const TZ = 'America/La_Paz';
const LIST_NAMES = { 1: 'Pendientes', 2: 'En Proceso', 3: 'Terminado' };

const minutesBetween = (from, to) => {
    if (!from || !to) return null;
    const diff = Math.round((new Date(to) - new Date(from)) / 60000);
    return diff >= 0 ? diff : null;
};

const toHours = (minutes) => (minutes === null ? null : Math.round((minutes / 60) * 100) / 100);

const averageHours = (values) => {
    const valid = values.filter((v) => v !== null);
    return valid.length ? Math.round((valid.reduce((a, b) => a + b, 0) / valid.length / 60) * 100) / 100 : null;
};

// Fecha y hora en Bolivia, ordenable como texto (AAAA-MM-DD HH:mm).
const stamp = (date) => (date ? moment(date).tz(TZ).format('YYYY-MM-DD HH:mm') : null);

// Reporte mensual de tiempos de las tareas (/tasks), para medir la respuesta interna:
//   - Respuesta: desde que se creó la tarea hasta que pasó por primera vez a "En Proceso" (o se terminó directo).
//   - Ejecución: desde ese inicio hasta que se terminó.
//   - Total: desde que se creó hasta que se terminó.
// Entran las tareas creadas o terminadas dentro del mes (hora de Bolivia). Hay una fila por tarea y responsable
// (una tarea con dos responsables aparece dos veces, para poder filtrar por persona); los totales cuentan cada tarea
// una sola vez. Las tareas anteriores a que se registraran estos tiempos pueden tener datos incompletos: esos tiempos
// salen vacíos y no entran en los promedios.
const report = {
    id: 'tiempos-tareas',
    title: 'Tiempos de tareas',
    description: 'Tiempos de respuesta y ejecución de las tareas de un mes, por tarea y responsable.',
    params: [{ key: 'mes', label: 'Mes', type: 'month', required: true }],
    build: async ({ mes }) => {
        const [year, month] = mes.split('-').map(Number);
        const from = moment.tz({ year, month: month - 1, day: 1 }, TZ).startOf('month').toDate();
        const to = moment.tz({ year, month: month - 1, day: 1 }, TZ).endOf('month').toDate();

        const cards = await md.tasks_cards.scope(['withReport']).findAll({
            where: {
                [Op.or]: [
                    { created_at: { [Op.between]: [from, to] } },
                    { date_completed: { [Op.between]: [from, to] } },
                ],
            },
            include: [
                {
                    model: md.usuarios,
                    as: 'responsibles',
                    through: { attributes: [] },
                    attributes: ['id', 'nombre'],
                },
            ],
            order: [['created_at', 'ASC'], ['id', 'ASC']],
        });

        const tasks = cards.map((card) => ({
            card,
            response: minutesBetween(card.created_at, card.started_at),
            execution: minutesBetween(card.started_at, card.date_completed),
            total: minutesBetween(card.created_at, card.date_completed),
        }));

        const rows = tasks.flatMap(({ card, response, execution, total }) => {
            const responsables = card.responsibles?.length ? card.responsibles.map((r) => r.nombre) : ['Sin responsable'];
            return responsables.map((responsable) => ({
                task_id: card.id,
                responsable,
                tarea: card.name || 'Sin título',
                cliente: card.report?.campana?.categoria?.empresa?.nombre ?? '',
                campana: card.report?.campana?.nombre ?? '',
                estado: LIST_NAMES[card.list_id] ?? '',
                creada: stamp(card.created_at),
                inicio: stamp(card.started_at),
                termino: stamp(card.date_completed),
                respuesta_horas: toHours(response),
                ejecucion_horas: toHours(execution),
                total_horas: toHours(total),
            }));
        });

        return {
            columns: [
                { key: 'responsable', title: 'Responsable', type: 'text' },
                { key: 'tarea', title: 'Tarea', type: 'text' },
                { key: 'cliente', title: 'Cliente', type: 'text' },
                { key: 'campana', title: 'Campaña', type: 'text' },
                { key: 'estado', title: 'Estado', type: 'text' },
                { key: 'creada', title: 'Creada', type: 'text' },
                { key: 'inicio', title: 'Inició', type: 'text' },
                { key: 'termino', title: 'Terminó', type: 'text' },
                { key: 'respuesta_horas', title: 'Respuesta (h)', type: 'money' },
                { key: 'ejecucion_horas', title: 'Ejecución (h)', type: 'money' },
                { key: 'total_horas', title: 'Total (h)', type: 'money' },
            ],
            rows,
            summary: [
                { key: 'tareas', label: 'Tareas del mes', value: tasks.length, type: 'integer' },
                { key: 'terminadas', label: 'Terminadas', value: tasks.filter((t) => t.card.date_completed).length, type: 'integer' },
                { key: 'avg_respuesta', label: 'Respuesta promedio (h)', value: averageHours(tasks.map((t) => t.response)), type: 'money' },
                { key: 'avg_ejecucion', label: 'Ejecución promedio (h)', value: averageHours(tasks.map((t) => t.execution)), type: 'money' },
                { key: 'avg_total', label: 'Total promedio (h)', value: averageHours(tasks.map((t) => t.total)), type: 'money' },
            ],
        };
    },
};

module.exports = { report };
