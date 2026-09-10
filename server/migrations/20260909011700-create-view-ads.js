'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('view_ads', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    id_reporte: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'reportes', key: 'id' },
    },
    imagen: { type: Sequelize.STRING(200), allowNull: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    orden: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    link_end_point: { type: Sequelize.TEXT, allowNull: true },
    title: { type: Sequelize.STRING(300), allowNull: true },
    image_url: { type: Sequelize.STRING, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('view_ads');
  },
};
