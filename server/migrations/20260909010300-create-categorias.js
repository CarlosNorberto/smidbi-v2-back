'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('categorias', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    nombre: { type: Sequelize.STRING(200), allowNull: false },
    descripcion: { type: Sequelize.STRING(300), allowNull: true },
    activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    id_cliente: { type: Sequelize.BIGINT, allowNull: true },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    id_usuario: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    id_empresa: {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: { model: 'empresas', key: 'id' },
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('categorias');
  },
};
