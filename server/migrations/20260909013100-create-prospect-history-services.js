'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'prospect_history_services', schema: 'lead_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    prospect_history_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: { tableName: 'prospect_history', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'CASCADE',
    },
    service_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: { tableName: 'services', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'CASCADE',
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'prospect_history_services', schema: 'lead_manager' });
  },
};
