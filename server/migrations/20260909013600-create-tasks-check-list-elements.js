'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks_check_list_elements', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    name: { type: Sequelize.STRING(300), allowNull: false },
    check_list_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'tasks_check_lists', key: 'id' },
    },
    order: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    completed: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tasks_check_list_elements');
  },
};
