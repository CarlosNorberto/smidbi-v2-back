'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE rol = 'hidden' LIMIT 1;`,
    );
    if (existing.length > 0) return;
    await queryInterface.bulkInsert('roles', [{
      rol: 'hidden',
      descripcion: 'Rol oculto, con acceso exclusivo a la pantalla de revisión de reportes',
      activo: true,
      usuario_creacion: 1,
      fecha_creacion: new Date(),
    }]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('roles', { rol: 'hidden' });
  },
};
