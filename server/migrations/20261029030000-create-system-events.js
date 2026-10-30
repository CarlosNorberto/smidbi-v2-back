'use strict';

// Registro de eventos/errores del sistema (Configuraciones > Registro de errores, solo superadmin). Tabla NUEVA: no
// toca ninguna tabla compartida con la app antigua.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('system_events', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      // error | warning | info
      level: { type: Sequelize.STRING(10), allowNull: false, defaultValue: 'error' },
      // asistente_ia | whatsapp | servidor | seguridad (ver services/systemEventService.js)
      category: { type: Sequelize.STRING(30), allowNull: false },
      // Quién lo generó dentro de la categoría (proveedor de IA, proceso de WhatsApp, ruta...)
      source: { type: Sequelize.STRING(120), allowNull: true },
      message: { type: Sequelize.TEXT, allowNull: false },
      // Detalle técnico: código, status, mensaje original del proveedor, stack...
      detail: { type: Sequelize.JSONB, allowNull: true },
      user_id: { type: Sequelize.INTEGER, allowNull: true },
      user_name: { type: Sequelize.STRING(150), allowNull: true },
      method: { type: Sequelize.STRING(10), allowNull: true },
      path: { type: Sequelize.STRING(300), allowNull: true },
      status_code: { type: Sequelize.INTEGER, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
    await queryInterface.addIndex('system_events', ['created_at'], { name: 'system_events_created_at_idx' });
    await queryInterface.addIndex('system_events', ['category', 'created_at'], { name: 'system_events_category_idx' });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('system_events');
  },
};
