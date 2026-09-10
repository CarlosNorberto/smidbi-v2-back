'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('usuarios', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    nombre: { type: Sequelize.STRING(200), allowNull: false },
    usuario: { type: Sequelize.STRING(100), allowNull: false },
    password: { type: Sequelize.STRING(100), allowNull: true },
    activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    padre: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
    email: { type: Sequelize.STRING(50), allowNull: false },
    dependientes: { type: Sequelize.ARRAY(Sequelize.INTEGER), allowNull: true },
    time_zone: { type: Sequelize.STRING, allowNull: true },
    phone: { type: Sequelize.STRING(30), allowNull: true },
    role_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'roles', key: 'id' },
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('usuarios');
  },
};
