'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('mapa_bolivia', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    id_reporte: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'reportes', key: 'id' },
    },
    lapaz: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    santacruz: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    cochabamba: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    oruro: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    tarija: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    pando: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    beni: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    sucre: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    potosi: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
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
    await queryInterface.dropTable('mapa_bolivia');
  },
};
