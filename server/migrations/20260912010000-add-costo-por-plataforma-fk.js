'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface) {
    // Antes de agregar la FK: si costo_por tiene id_plataforma que ya no existen en
    // plataformas (referencias huérfanas de borrados físicos de la app antigua, antes
    // de que existiera la regla de "no borrar, solo desactivar"), se crea una fila
    // placeholder inactiva por cada una, para no perder esas filas de costo_por.
    const [orphans] = await queryInterface.sequelize.query(`
      SELECT DISTINCT cp.id_plataforma
      FROM costo_por cp
      LEFT JOIN plataformas p ON p.id = cp.id_plataforma
      WHERE p.id IS NULL AND cp.id_plataforma IS NOT NULL
    `);

    for (const { id_plataforma } of orphans) {
      await queryInterface.sequelize.query(
        `INSERT INTO plataformas (id, plataforma, activo, usuario_creacion, fecha_creacion)
         VALUES (:id, 'Plataforma no disponible (histórico)', false, 1, now())
         ON CONFLICT (id) DO NOTHING`,
        { replacements: { id: id_plataforma } }
      );
    }

    // FK real: de ahora en adelante costo_por.id_plataforma siempre debe apuntar a una
    // fila existente de plataformas. ON DELETE RESTRICT refuerza a nivel de base de
    // datos la regla de negocio de "plataformas no se borra, solo se desactiva".
    await queryInterface.addConstraint('costo_por', {
      fields: ['id_plataforma'],
      type: 'foreign key',
      name: 'costo_por_id_plataforma_fkey',
      references: { table: 'plataformas', field: 'id' },
      onDelete: 'RESTRICT',
      onUpdate: 'CASCADE',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeConstraint('costo_por', 'costo_por_id_plataforma_fkey');
    // Las filas placeholder de plataformas creadas en el "up" quedan (son dato
    // histórico legítimo, no revertirlas evita volver a romper la integridad).
  },
};
