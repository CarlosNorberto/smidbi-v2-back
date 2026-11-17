'use strict';

// Un día bloqueado (reporte_dia.bloqueado = true) NO debe cambiar de valor por ningún proceso automático. El que lo cambiaba
// es el cron diario de las 6:00 del backend antiguo (BACK-END/cron/scheduler.js: escribe el valor del día anterior), que no
// conoce el bloqueo y que no se toca desde aquí. En lugar de depender de que cada proceso se acuerde de mirar la marca, la base
// la hace respetar: un trigger BEFORE UPDATE deja el valor como estaba cuando la fila está bloqueada.
//
// - Solo se dispara para filas bloqueadas (cláusula WHEN): el resto de los UPDATE no paga nada.
// - No lanza error (el cron antiguo no se cae): simplemente conserva el valor.
// - La edición MANUAL desde el sistema nuevo avisa con `SELECT set_config('smidbi.edicion_manual_dia','on', true)` dentro de
//   su transacción (ver withManualDayEdit en controllers/campaign_manager/reportes.js); solo así se permite cambiar el valor.
// - Compatible con PostgreSQL 10 (producción): EXECUTE PROCEDURE y current_setting(nombre, true).
module.exports = {
  async up(queryInterface) {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE FUNCTION reporte_dia_respetar_bloqueo() RETURNS trigger AS $$
      BEGIN
        IF COALESCE(current_setting('smidbi.edicion_manual_dia', true), '') <> 'on' THEN
          NEW.valor := OLD.valor;
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS reporte_dia_bloqueo ON reporte_dia;`);
    await queryInterface.sequelize.query(`
      CREATE TRIGGER reporte_dia_bloqueo
      BEFORE UPDATE ON reporte_dia
      FOR EACH ROW
      WHEN (OLD.bloqueado IS TRUE)
      EXECUTE PROCEDURE reporte_dia_respetar_bloqueo();
    `);
  },

  async down(queryInterface) {
    await queryInterface.sequelize.query(`DROP TRIGGER IF EXISTS reporte_dia_bloqueo ON reporte_dia;`);
    await queryInterface.sequelize.query(`DROP FUNCTION IF EXISTS reporte_dia_respetar_bloqueo();`);
  },
};
