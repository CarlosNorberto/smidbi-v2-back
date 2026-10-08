'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Modelo de cobro real (CPC, CPV o CPE) de los costos con tipo 'CPC_CPV'.
    // Los costos CPM no lo usan (queda en NULL): CPM ya se distingue por `tipo`.
    await queryInterface.addColumn('costo_por', 'modelo', {
      type: Sequelize.STRING(3),
      allowNull: true,
    });

    // Relleno inicial a partir del nombre del formato (ej. "Display CPC").
    // Lo que no coincida queda en NULL para definirlo desde la administración.
    await queryInterface.sequelize.query(`
      UPDATE costo_por
      SET modelo = CASE
        WHEN nombre ILIKE '%CPV%' THEN 'CPV'
        WHEN nombre ILIKE '%CPE%' THEN 'CPE'
        WHEN nombre ILIKE '%CPC%' THEN 'CPC'
      END
      WHERE tipo = 'CPC_CPV'
    `);
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('costo_por', 'modelo');
  },
};
