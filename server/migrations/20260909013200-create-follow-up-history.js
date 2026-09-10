'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'follow_up_history', schema: 'lead_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    prospect_history_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: { tableName: 'prospect_history', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'CASCADE',
    },
    description: { type: Sequelize.TEXT, allowNull: false },
    type: { type: Sequelize.STRING, allowNull: false },
    create_date: { type: Sequelize.DATE, allowNull: false },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'follow_up_history', schema: 'lead_manager' });
  },
};
