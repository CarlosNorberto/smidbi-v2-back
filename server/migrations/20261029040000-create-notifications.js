'use strict';

// Notificaciones de la campanita que NO son tareas (las tareas asignadas se calculan aparte, ver tasks_cards
// getAssignedToMe). Hoy: avisos de que el asistente IA dejó de funcionar. Tabla NUEVA: no toca tablas de la app antigua.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('notifications', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      user_id: { type: Sequelize.INTEGER, allowNull: false },
      // Clave estable del tipo de aviso (ej. ai_AI_NO_CREDIT): evita repetir un aviso que sigue sin leerse.
      type: { type: Sequelize.STRING(60), allowNull: false },
      title: { type: Sequelize.STRING(200), allowNull: false },
      body: { type: Sequelize.TEXT, allowNull: true },
      // Ruta del frontend a la que lleva al hacer clic (ej. /admin/system_settings)
      link: { type: Sequelize.STRING(300), allowNull: true },
      read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('notifications', ['user_id', 'read_at'], { name: 'notifications_user_read_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('notifications');
  },
};
