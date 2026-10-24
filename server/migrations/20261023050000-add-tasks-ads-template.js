'use strict';

// Plantilla de creación de campaña de la "Pieza de campaña" (/tasks): campaña, plataforma, modelo de compra, inversión,
// fechas, proyección de objetivos, KPIs, nombre del anuncio y observaciones. Se guarda como un JSON en una columna
// opcional (NULL), así no afecta a la app antigua, que comparte la tabla.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('tasks_ads', 'template', { type: Sequelize.JSONB, allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('tasks_ads', 'template');
  },
};
