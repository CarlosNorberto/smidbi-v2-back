'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks_tags', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    name: { type: Sequelize.STRING(100), allowNull: true },
    color: { type: Sequelize.STRING(10), allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tasks_tags');
  },
};
