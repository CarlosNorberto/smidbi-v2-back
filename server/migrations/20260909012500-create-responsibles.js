'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'responsibles', schema: 'lead_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    responsible: { type: Sequelize.STRING, allowNull: false },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'responsibles', schema: 'lead_manager' });
  },
};
