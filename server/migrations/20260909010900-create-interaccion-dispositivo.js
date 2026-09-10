'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('interaccion_dispositivo', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    porcentaje_tablet: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    porcentaje_smartphone: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    porcentaje_laptop: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    id_reporte: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'reportes', key: 'id' },
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('interaccion_dispositivo');
  },
};
