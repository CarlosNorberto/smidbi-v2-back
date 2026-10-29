'use strict';

// Emoji de cada temperatura del CRM (lead_manager.customer_temperature). Antes el ícono salía de una tabla fija
// en el frontend según el nombre. Columna opcional (NULL): no afecta a la app antigua, que comparte la tabla.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'customer_temperature', schema: 'lead_manager' },
      'icon',
      { type: Sequelize.STRING(16), allowNull: true }
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn({ tableName: 'customer_temperature', schema: 'lead_manager' }, 'icon');
  },
};
