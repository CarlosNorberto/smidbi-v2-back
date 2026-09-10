'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'application_status', schema: 'contract_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    application_status_name: { type: Sequelize.STRING, allowNull: false },
    bgcolor: { type: Sequelize.STRING, allowNull: true, defaultValue: '#fff' },
    color: { type: Sequelize.STRING, allowNull: true, defaultValue: '#000' },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'application_status', schema: 'contract_manager' });
  },
};
