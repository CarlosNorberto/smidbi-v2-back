'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE rol = 'superadmin' LIMIT 1;`,
    );
    if (existing.length > 0) return;

    await queryInterface.bulkInsert('roles', [
      {
        rol: 'superadmin',
        descripcion:
          'Control total del sistema, con acceso exclusivo a la pantalla de configuraciones del sistema',
        activo: true,
        usuario_creacion: 1,
        fecha_creacion: new Date(),
      },
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', { rol: 'superadmin' });
  },
};
