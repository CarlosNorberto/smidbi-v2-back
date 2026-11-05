'use strict';

// Rol "contracts" (Gestor de contratos): puede ver y administrar el Gestor de Contratos (incluido eliminar contratos);
// admin y superadmin también, el resto de roles no. En todo lo demás se comporta como el rol 'user' (el sistema solo
// distingue "admin/superadmin" del resto). Ver server/auth/roles.js.
//
// Es aditiva: solo agrega una fila a `roles`. Se busca por nombre y no por id porque el id puede ser distinto entre
// entornos. Es idempotente: si el rol ya existe, no hace nada.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE rol = 'contracts' LIMIT 1;`,
    );
    if (existing.length > 0) return;

    await queryInterface.bulkInsert('roles', [{
      rol: 'contracts',
      descripcion: 'Gestor de contratos: administra el Gestor de Contratos (crear, editar y eliminar contratos)',
      activo: true,
      usuario_creacion: 1,
      fecha_creacion: new Date(),
    }]);
  },

  async down(queryInterface) {
    // Los usuarios que tenían este rol vuelven a 'user' (el más restringido) antes de borrarlo.
    await queryInterface.sequelize.query(
      `UPDATE usuarios
          SET role_id = (SELECT id FROM roles WHERE rol = 'user' LIMIT 1)
        WHERE role_id = (SELECT id FROM roles WHERE rol = 'contracts' LIMIT 1);`,
    );
    await queryInterface.bulkDelete('roles', { rol: 'contracts' });
  },
};
