'use strict';

// Rol "contracts_leads" (Gestor de contratos y prospectos): abre los dos módulos, el Gestor de Contratos y el CRM
// (`lead_manager`), para quien necesita ambos. Admin y superadmin también ven los dos; el resto de roles no. En todo lo
// demás se comporta como el rol 'user'. Ver server/auth/roles.js.
//
// Es aditiva: solo agrega una fila a `roles`. Se busca por nombre y no por id porque el id puede ser distinto entre
// entornos. Es idempotente: si el rol ya existe, no hace nada.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [existing] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE rol = 'contracts_leads' LIMIT 1;`,
    );
    if (existing.length > 0) return;

    await queryInterface.bulkInsert('roles', [{
      rol: 'contracts_leads',
      descripcion: 'Gestor de contratos y prospectos: administra el Gestor de Contratos y el CRM',
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
        WHERE role_id = (SELECT id FROM roles WHERE rol = 'contracts_leads' LIMIT 1);`,
    );
    await queryInterface.bulkDelete('roles', { rol: 'contracts_leads' });
  },
};
