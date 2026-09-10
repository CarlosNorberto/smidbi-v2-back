'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'contracts', schema: 'contract_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    application_date: { type: Sequelize.DATE, allowNull: true },
    applicant_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'usuarios', key: 'id' },
    },
    client_support_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'usuarios', key: 'id' },
    },
    responsible_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'usuarios', key: 'id' },
    },
    application_status_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: { tableName: 'application_status', schema: 'contract_manager' }, key: 'id' },
    },
    final_state_id: { type: Sequelize.INTEGER, allowNull: true },
    write_date: { type: Sequelize.DATE, allowNull: true },
    create_date: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.NOW },
    company_form_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: { tableName: 'company_form', schema: 'contract_manager' }, key: 'id' },
      onDelete: 'CASCADE',
    },
    start_date: { type: Sequelize.DATE, allowNull: true },
    end_date: { type: Sequelize.DATE, allowNull: true },
    observations: { type: Sequelize.TEXT, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'contracts', schema: 'contract_manager' });
  },
};
