'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks_cards', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    name: { type: Sequelize.STRING(200), allowNull: true },
    description: { type: Sequelize.TEXT, allowNull: true },
    report_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'reportes', key: 'id' },
    },
    order: { type: Sequelize.FLOAT, allowNull: true, defaultValue: 0 },
    list_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'tasks_lists', key: 'id' },
    },
    exp_date_day: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    exp_date_month: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    exp_date_year: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    exp_time_hour: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    exp_time_minute: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    completed: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    archived: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    sent_reminder: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    reminder_time: { type: Sequelize.INTEGER, allowNull: true, defaultValue: -1 },
    date_completed: { type: Sequelize.DATE, allowNull: true },
    user_id: { type: Sequelize.INTEGER, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tasks_cards');
  },
};
