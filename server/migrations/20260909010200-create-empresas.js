'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('empresas', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    nombre: { type: Sequelize.STRING(200), allowNull: false },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    activo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    descripcion: { type: Sequelize.STRING(300), allowNull: true },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    usuario: { type: Sequelize.STRING(100), allowNull: true },
    password: { type: Sequelize.STRING(100), allowNull: true },
    email: { type: Sequelize.STRING(100), allowNull: true },
    link_aux: { type: Sequelize.STRING(200), allowNull: true },
    id_usuario: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      references: { model: 'usuarios', key: 'id' },
    },
    num_plantilla_contrato: { type: Sequelize.INTEGER, allowNull: true },
    contrato_pdf: { type: Sequelize.STRING(200), allowNull: true },
    code: { type: Sequelize.STRING, allowNull: true },
    link_databi: { type: Sequelize.TEXT, allowNull: true },
    mobile: { type: Sequelize.STRING, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('empresas');
  },
};
