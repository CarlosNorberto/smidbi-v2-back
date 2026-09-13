'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('plataformas', 'bloqueada', {
      type: Sequelize.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    });

    // Las filas placeholder creadas por la migración anterior (huérfanos de
    // costo_por sin plataforma real) quedan bloqueadas: no se pueden editar ni
    // activar desde la UI de administración, para no dar de alta por error una
    // plataforma real bajo ese nombre genérico.
    await queryInterface.sequelize.query(
      `UPDATE plataformas SET bloqueada = true WHERE plataforma = 'Plataforma no disponible (histórico)'`
    );
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('plataformas', 'bloqueada');
  },
};
