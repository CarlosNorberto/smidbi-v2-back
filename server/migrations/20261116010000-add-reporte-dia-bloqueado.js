'use strict';

// Marca de "valor bloqueado" por día (Revisión de días): la Redistribución no toca un día bloqueado y reparte lo demás
// alrededor de él. Columna opcional SIN valor por defecto a propósito: reporte_dia tiene millones de filas y, en PostgreSQL
// anterior al 11, agregar una columna con DEFAULT reescribe toda la tabla. NULL se lee como "no bloqueado"; la app antigua,
// que comparte la tabla, no se entera.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('reporte_dia', 'bloqueado', { type: Sequelize.BOOLEAN, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('reporte_dia', 'bloqueado');
  },
};
