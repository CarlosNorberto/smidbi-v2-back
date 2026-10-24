'use strict';

// Historial de gestiones: quién registró cada gestión y cuándo/quién la editó por última vez.
// Columnas opcionales (NULL) para no afectar al sistema anterior, que comparte la tabla.
module.exports = {
  async up(queryInterface, Sequelize) {
    const table = { tableName: 'follow_up_history', schema: 'lead_manager' };
    await queryInterface.addColumn(table, 'created_by', { type: Sequelize.STRING(200), allowNull: true });
    await queryInterface.addColumn(table, 'updated_by', { type: Sequelize.STRING(200), allowNull: true });
    await queryInterface.addColumn(table, 'updated_at', { type: Sequelize.DATE, allowNull: true });
  },

  async down(queryInterface) {
    const table = { tableName: 'follow_up_history', schema: 'lead_manager' };
    await queryInterface.removeColumn(table, 'created_by');
    await queryInterface.removeColumn(table, 'updated_by');
    await queryInterface.removeColumn(table, 'updated_at');
  },
};
