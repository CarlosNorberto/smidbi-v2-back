'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks_cards_tags', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    card_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'tasks_cards', key: 'id' },
      onDelete: 'CASCADE',
    },
    tag_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'tasks_tags', key: 'id' },
      onDelete: 'CASCADE',
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tasks_cards_tags');
  },
};
