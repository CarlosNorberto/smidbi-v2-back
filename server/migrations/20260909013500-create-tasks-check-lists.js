'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks_check_lists', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    title: { type: Sequelize.STRING(200), allowNull: false },
    order: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tasks_check_lists');
  },
};
