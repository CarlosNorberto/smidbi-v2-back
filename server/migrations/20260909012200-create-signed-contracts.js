'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'signed_contracts', schema: 'contract_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    contract_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: { tableName: 'contracts', schema: 'contract_manager' }, key: 'id' },
      onDelete: 'CASCADE',
    },
    filename: { type: Sequelize.STRING, allowNull: true },
    originalname: { type: Sequelize.STRING, allowNull: true },
    type: { type: Sequelize.STRING, allowNull: true },
    create_date: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.NOW },
    url: { type: Sequelize.STRING, allowNull: true },
    public_id: { type: Sequelize.STRING, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'signed_contracts', schema: 'contract_manager' });
  },
};
