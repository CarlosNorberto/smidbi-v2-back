'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Tipos incluidos en el PDF generado (ej. 'CPC_CPV,CPM', ordenados). Permite
    // reutilizar el PDF ya generado cuando se vuelve a pedir con los mismos tipos,
    // sin crear otra fila en pdf_planificador. Nullable: las filas de la app antigua
    // no la tienen y la app antigua ignora la columna.
    await queryInterface.addColumn('pdf_planificador', 'tipos', {
      type: Sequelize.STRING(50),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('pdf_planificador', 'tipos');
  },
};
