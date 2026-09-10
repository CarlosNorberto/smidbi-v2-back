'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('interaccion_genero', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    porcentaje: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    genero: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'hombres' },
    activo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    id_reporte: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0,
      references: { model: 'reportes', key: 'id' },
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('interaccion_genero');
  },
};
