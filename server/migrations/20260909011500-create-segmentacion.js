'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('segmentacion', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    id_reporte: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'reportes', key: 'id' },
    },
    activo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.NOW },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    segmentacion: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
    demografia: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
    geo_segmentacion: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
    retargeting: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
    learning: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
    palabras_clave: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('segmentacion');
  },
};
