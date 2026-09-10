'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('interaccion_hora', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    id_reporte: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'reportes', key: 'id' },
    },
    h1: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h2: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h3: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h4: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h5: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h6: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h7: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h8: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h9: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h10: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h11: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h12: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h13: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h14: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h15: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h16: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h17: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h18: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h19: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h20: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h21: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h22: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h23: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    h24: { type: Sequelize.DECIMAL(4, 1), allowNull: true, defaultValue: 0 },
    activo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('interaccion_hora');
  },
};
