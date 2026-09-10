'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks_activities', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    card_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'tasks_cards', key: 'id' },
      onDelete: 'CASCADE',
    },
    activity_detail: { type: Sequelize.TEXT, allowNull: true },
    date_activity: { type: Sequelize.DATE, allowNull: true },
    responsible_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'usuarios', key: 'id' },
      onDelete: 'CASCADE',
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tasks_activities');
  },
};
