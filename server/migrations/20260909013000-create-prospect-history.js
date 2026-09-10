'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'prospect_history', schema: 'lead_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    prospect_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: { tableName: 'prospects', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'CASCADE',
    },
    responsible_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: { tableName: 'responsibles', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'SET NULL',
    },
    status_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: { tableName: 'status', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'SET NULL',
    },
    date: { type: Sequelize.DATEONLY, allowNull: true },
    observations: { type: Sequelize.TEXT, allowNull: true },
    meeting_status_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: { tableName: 'status', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'SET NULL',
    },
    situation: { type: Sequelize.TEXT, allowNull: true },
    last_contact: { type: Sequelize.DATEONLY, allowNull: true },
    final_state_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: { tableName: 'status', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'SET NULL',
    },
    order: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    write_date: { type: Sequelize.DATE, allowNull: true },
    create_date: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.NOW },
    partner: { type: Sequelize.STRING, allowNull: true },
    fuente_medio: { type: Sequelize.TEXT, allowNull: true },
    stage_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: { tableName: 'stages', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'CASCADE',
    },
    customer_temperature_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: { tableName: 'customer_temperature', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'SET NULL',
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'prospect_history', schema: 'lead_manager' });
  },
};
