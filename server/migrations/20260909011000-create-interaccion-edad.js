'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('interaccion_edad', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    porcentaje1: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    porcentaje2: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    porcentaje3: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    porcentaje4: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    porcentaje5: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    porcentaje6: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    porcentaje7: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    porcentaje0: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
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
      references: { model: 'reportes', key: 'id' },
    },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('interaccion_edad');
  },
};
