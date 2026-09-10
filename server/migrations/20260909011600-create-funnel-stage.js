'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('funnel_stage', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    id_reporte: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'reportes', key: 'id' },
    },
    punto1: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    punto2: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    punto3: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    punto4: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: false },
    activo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('funnel_stage');
  },
};
