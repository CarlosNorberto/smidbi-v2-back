'use strict';

// Tiempos de las tareas (/tasks) para medir los tiempos de respuesta internos:
//   created_at        cuándo se creó la tarea
//   started_at        cuándo pasó por primera vez a "En Proceso" (fin del tiempo de respuesta)
//   last_notified_at  último aviso por WhatsApp enviado a sus responsables
// (date_completed, que ya existía, marca cuándo se terminó.)
// Son columnas opcionales (NULL): no afectan a la app antigua, que comparte la tabla. Para las tareas
// anteriores se rellenan desde la bitácora (tasks_activities), que ya registraba cuándo se crearon y se movieron.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tasks_cards', 'created_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('tasks_cards', 'started_at', { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn('tasks_cards', 'last_notified_at', { type: Sequelize.DATE, allowNull: true });

    await queryInterface.sequelize.query(`
      UPDATE tasks_cards c
      SET created_at = a.first_at
      FROM (
        SELECT card_id, MIN(date_activity) AS first_at
        FROM tasks_activities
        WHERE activity_detail LIKE 'Creó la tarjeta%'
        GROUP BY card_id
      ) a
      WHERE a.card_id = c.id AND c.created_at IS NULL;
    `);
    await queryInterface.sequelize.query(`
      UPDATE tasks_cards c
      SET started_at = a.first_at
      FROM (
        SELECT card_id, MIN(date_activity) AS first_at
        FROM tasks_activities
        WHERE activity_detail = 'Movió la tarjeta a En Proceso'
        GROUP BY card_id
      ) a
      WHERE a.card_id = c.id AND c.started_at IS NULL;
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tasks_cards', 'last_notified_at');
    await queryInterface.removeColumn('tasks_cards', 'started_at');
    await queryInterface.removeColumn('tasks_cards', 'created_at');
  },
};
