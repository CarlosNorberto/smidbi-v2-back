'use strict';

// Los usuarios con `role_id` NULL no tienen rol, y el código asume que todo
// usuario tiene uno (`req.user.role.rol`): quedan sin acceso coherente (ni
// restringidos como 'user' ni con permisos de admin). Se les asigna el rol
// 'user', el más restringido. Se busca por nombre y no por id porque el id del
// rol puede ser distinto entre entornos.
//
// Es idempotente: si ya no quedan usuarios sin rol, no hace nada.

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    const [roles] = await queryInterface.sequelize.query(
      `SELECT id FROM roles WHERE rol = 'user' LIMIT 1;`,
    );
    if (roles.length === 0) {
      throw new Error("No existe el rol 'user' en la tabla roles; no se pueden asignar roles por defecto.");
    }

    await queryInterface.sequelize.query(
      `UPDATE usuarios SET role_id = :roleId WHERE role_id IS NULL;`,
      { replacements: { roleId: roles[0].id } },
    );
  },

  async down() {
    // No se puede saber qué usuarios estaban sin rol antes de la migración,
    // así que no se revierte (dejarlos como 'user' es el estado seguro).
  },
};
