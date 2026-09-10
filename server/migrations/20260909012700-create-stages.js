'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'stages', schema: 'lead_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    name: { type: Sequelize.STRING, allowNull: false },
    sort_order: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    kind: { type: Sequelize.STRING, allowNull: false, defaultValue: 'open' },
    color: { type: Sequelize.STRING, allowNull: true, defaultValue: '#e5e7eb' },
    is_active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'stages', schema: 'lead_manager' });
  },
};
