'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('plataformas', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    plataforma: { type: Sequelize.STRING(100), allowNull: false },
    activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    icono: { type: Sequelize.STRING(200), allowNull: true },
    code: { type: Sequelize.STRING, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('plataformas');
  },
};
