'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks_card_checklist', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    card_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'tasks_cards', key: 'id' },
      onDelete: 'CASCADE',
    },
    check_list_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'tasks_check_lists', key: 'id' },
      onDelete: 'CASCADE',
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tasks_card_checklist');
  },
};
