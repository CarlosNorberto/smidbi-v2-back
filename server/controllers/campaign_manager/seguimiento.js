const md = require('../../models');
const { isUnrestricted } = require('../../auth/ownership');

// Columnas del tablero de tareas (tasks_lists): 1 Pendientes, 2 En Proceso, 3 Terminado.
const TASK_STATUS_LIST = { pending: 1, progress: 2, done: 3 };
const taskCount = (listId) =>
    `(SELECT COUNT(*)::int FROM "tasks_cards" AS "tc" WHERE "tc"."report_id" = "reportes"."id" AND "tc"."list_id" = ${listId})`;

const loadTracking = async (req, res) => {
    try {
        const { page = 1, limit = 10 } = req.query;
        const { user_ids, companie_ids, platform_id, month, year, task_status } = req.body;
        let general_where = {
            activo: true,
            fecha_ini: { [md.Sequelize.Op.ne]: null },
        };
        let client_where = {};
        // Solo admin y superadmin pueden ver (y filtrar por) otros responsables. El resto ve únicamente lo de las empresas de las
        // que es responsable, sin importar lo que mande en `user_ids` (el filtro del frontend se oculta, pero esto es lo que protege).
        const restrictToOwn = !isUnrestricted(req.user);
        if (!restrictToOwn && user_ids) {
            client_where.id_usuario = {
                [md.Sequelize.Op.in]: user_ids
            };
        }
        if (platform_id) {
            general_where.id_plataforma = platform_id;
        }
        if (month && year) {
            general_where.fecha_ini = { [md.Sequelize.Op.gte]: new Date(year, month - 1, 1) };
            general_where.fecha_fin = { [md.Sequelize.Op.lte]: new Date(year, month, 0) };
        }
        if (companie_ids && companie_ids.length > 0) {
            if (typeof companie_ids === 'string')
                client_where.id_empresa = {
                    [md.Sequelize.Op.in]: companie_ids.split(',')
                };
            else
                client_where.id_empresa = {
                    [md.Sequelize.Op.in]: companie_ids
                };
        }

        // Filtro por estado de tareas: reportes con al menos una tarea en alguno de los estados pedidos ('none' = sin tareas).
        const statuses = (Array.isArray(task_status) ? task_status : []).filter((st) => st === 'none' || TASK_STATUS_LIST[st]);
        if (statuses.length > 0) {
            const conditions = statuses.map((st) =>
                st === 'none'
                    ? `NOT EXISTS (SELECT 1 FROM "tasks_cards" AS "tc" WHERE "tc"."report_id" = "reportes"."id")`
                    : `EXISTS (SELECT 1 FROM "tasks_cards" AS "tc" WHERE "tc"."report_id" = "reportes"."id" AND "tc"."list_id" = ${TASK_STATUS_LIST[st]})`,
            );
            general_where[md.Sequelize.Op.and] = [md.Sequelize.literal(`(${conditions.join(' OR ')})`)];
        }

        const reports = await md.reportes.findAndCountAll({
            where: general_where,
            attributes: {
                include: [
                    // suma total facturado por reporte
                    [md.Sequelize.literal(`(SELECT SUM("presupuesto") FROM "reportes" AS "r" WHERE "r"."id_campana" = "reportes"."id_campana")`), 'total_facturado'],
                    // tareas del reporte por estado
                    [md.Sequelize.literal(taskCount(TASK_STATUS_LIST.pending)), 'tasks_pending'],
                    [md.Sequelize.literal(taskCount(TASK_STATUS_LIST.progress)), 'tasks_progress'],
                    [md.Sequelize.literal(taskCount(TASK_STATUS_LIST.done)), 'tasks_done'],
                    // porcentaje_plataforma * presupuesto
                    [md.Sequelize.literal(`"reportes"."porc_plataforma" * "reportes"."presupuesto"`), 'en_plataforma'],
                    // Monto por dia
                    [md.Sequelize.literal(`
                        ROUND(
                            CASE 
                                WHEN ("reportes"."fecha_fin"::date - CURRENT_DATE::date + 1) > 0 
                                THEN (("reportes"."porc_plataforma" * "reportes"."presupuesto") - COALESCE("reportes"."ejecutado", 0)) / ("reportes"."fecha_fin"::date - CURRENT_DATE::date + 1)
                                ELSE 0
                            END
                        ,2)
                    `), 'monto_por_dia'],
                    // Dias restantes
                    [md.Sequelize.literal(`"reportes"."fecha_fin"::date - CURRENT_DATE + 1`), 'dias_restantes']
                ],
                exclude: [
                    'usuario_creacion',
                    'usuario_modificacion',
                    'usuario_eliminacion',
                    'fecha_creacion',
                    'fecha_modificacion',
                    'fecha_eliminacion',
                    'fecha_inicio',
                    'fecha_final',
                    'link', 'link_w', 'link_h',
                    'id_campaign',
                    'id_campana',
                    'id_plataforma',
                    'id_objetivo'
                ]
            },
            include: [
                {
                    model: md.campanas,
                    as: 'campana',
                    required: true,
                    attributes: ['id', 'nombre'],
                    include: [
                        {
                            model: md.categorias,
                            as: 'categoria',
                            required: true,
                            attributes: ['id', 'nombre'],
                            where: client_where,
                            include: [
                                {
                                    model: md.empresas,
                                    as: 'empresa',
                                    attributes: ['id', 'nombre'],
                                    ...(restrictToOwn ? { where: { id_usuario: req.user.id }, required: true } : {}),
                                }
                            ]
                        }
                    ]
                },
                {
                    model: md.plataformas,
                    as: 'plataforma',
                    attributes: ['id', 'plataforma']
                },
                {
                    model: md.objetivos,
                    as: 'objetivo',
                    attributes: ['id', 'objetivo']
                }
            ],
            limit,
            offset: (page - 1) * limit,
            order: [
                // order desc fecha_ini
                ['fecha_ini', 'DESC'],
                // order by company (empresa)
                [{ model: md.campanas, as: 'campana' }, { model: md.categorias, as: 'categoria' }, { model: md.empresas, as: 'empresa' }, 'nombre', 'ASC'],
                // order by category (categoria)
                [{ model: md.campanas, as: 'campana' }, { model: md.categorias, as: 'categoria' }, 'nombre', 'ASC'],
                // order by campaign (campaña)
                [{ model: md.campanas, as: 'campana' }, 'nombre', 'ASC']
            ]
        });
        // Detalle de tareas solo de los reportes de esta página (para el popover de la columna "Tareas").
        const reportIds = reports.rows.map((r) => r.id);
        const cards = reportIds.length
            ? await md.tasks_cards.findAll({
                where: { report_id: reportIds },
                attributes: ['id', 'name', 'list_id', 'report_id'],
                include: [{ model: md.usuarios, as: 'responsibles', attributes: ['id', 'nombre'], through: { attributes: [] }, required: false }],
                order: [['list_id', 'ASC'], ['order', 'ASC'], ['id', 'ASC']],
            })
            : [];
        const byReport = {};
        for (const c of cards) (byReport[c.report_id] ||= []).push({
            id: c.id,
            name: c.name,
            list_id: c.list_id,
            responsibles: (c.responsibles || []).map((u) => u.nombre),
        });
        const rows = reports.rows.map((r) => ({ ...r.toJSON(), tasks: byReport[r.id] || [] }));
        res.status(200).json({ count: reports.count, rows });
    } catch (error) {
        res.status(500).json({ message: 'Internal server error' + error.message });
    }
};

module.exports = {
    loadTracking,
};