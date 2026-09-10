'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'customer_temperature', schema: 'lead_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    name: { type: Sequelize.STRING, allowNull: false },
    description: { type: Sequelize.TEXT, allowNull: true },
    sort_order: { type: Sequelize.INTEGER, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'customer_temperature', schema: 'lead_manager' });
  },
};
