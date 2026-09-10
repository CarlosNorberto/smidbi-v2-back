'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reporte_dia', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    id_reporte: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'reportes', key: 'id' },
    },
    valor: { type: Sequelize.INTEGER, allowNull: true },
    dia: { type: Sequelize.INTEGER, allowNull: true },
    mes: { type: Sequelize.INTEGER, allowNull: true },
    anio: { type: Sequelize.INTEGER, allowNull: true },
    fecha_creacion: { type: Sequelize.DATE, allowNull: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    id_objetivo: {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: 'objetivos', key: 'id' },
    },
    media_cost: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
    rango_edad: { type: Sequelize.INTEGER, allowNull: true },
    genero: { type: Sequelize.INTEGER, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reporte_dia');
  },
};
