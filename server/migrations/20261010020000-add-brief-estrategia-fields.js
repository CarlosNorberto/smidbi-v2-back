'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Formulario público de brief simplificado (estrategia de campaña): datos nuevos que no tenían columna.
    // Son opcionales (NULL) para no afectar a la app antigua, que comparte la tabla.
    await queryInterface.addColumn('request_brief', 'publico_objetivo', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('request_brief', 'kpis', { type: Sequelize.TEXT, allowNull: true });
    await queryInterface.addColumn('request_brief', 'entregables', { type: Sequelize.TEXT, allowNull: true });

    // "Competencia y referentes" puede ser más largo que los 200 caracteres de la columna original.
    // Ampliar de varchar(200) a text no cambia los datos existentes ni rompe a la app antigua.
    await queryInterface.changeColumn('request_brief', 'competencia_directa', { type: Sequelize.TEXT, allowNull: true });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.removeColumn('request_brief', 'publico_objetivo');
    await queryInterface.removeColumn('request_brief', 'kpis');
    await queryInterface.removeColumn('request_brief', 'entregables');
    // No se vuelve a varchar(200): podría truncar textos más largos ya guardados.
  },
};
