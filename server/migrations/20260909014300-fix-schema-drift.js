'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn(
      { tableName: 'prospect_history', schema: 'lead_manager' },
      'stage_id',
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: { tableName: 'stages', schema: 'lead_manager' }, key: 'id' },
        onDelete: 'CASCADE',
      },
    );

    await queryInterface.addColumn(
      { tableName: 'prospect_history', schema: 'lead_manager' },
      'customer_temperature_id',
      {
        type: Sequelize.INTEGER,
        allowNull: true,
        references: { model: { tableName: 'customer_temperature', schema: 'lead_manager' }, key: 'id' },
        onDelete: 'SET NULL',
      },
    );

    await queryInterface.addColumn(
      { tableName: 'company_form', schema: 'contract_manager' },
      'end_date_consulting',
      { type: Sequelize.STRING, allowNull: true },
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn({ tableName: 'prospect_history', schema: 'lead_manager' }, 'stage_id');
    await queryInterface.removeColumn({ tableName: 'prospect_history', schema: 'lead_manager' }, 'customer_temperature_id');
    await queryInterface.removeColumn({ tableName: 'company_form', schema: 'contract_manager' }, 'end_date_consulting');
  },
};
