'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('objetivos', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    objetivo: { type: Sequelize.STRING(150), allowNull: false },
    activo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.NOW },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    kpi_sec: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('objetivos');
  },
};
