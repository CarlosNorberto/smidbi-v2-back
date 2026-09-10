'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reporte_objetivos_secundarios', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    id_reporte: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'reportes', key: 'id' },
    },
    id_objetivo: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'objetivos', key: 'id' },
    },
    valor: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    activo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reporte_objetivos_secundarios');
  },
};
