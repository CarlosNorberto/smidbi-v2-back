'use strict';

// Índices en las columnas que relacionan una tabla con otra (id_usuario, id_empresa, id_categoria, id_campana,
// id_reporte...). PostgreSQL NO crea un índice al definir una relación (foreign key), y muchas de estas columnas no
// tienen ninguno: cada consulta "reportes de la campaña X", "campañas de la categoría Y" o "tareas del usuario Z" recorre
// la tabla completa. Un índice solo ACELERA lecturas: no cambia qué datos se aceptan ni qué se puede borrar, así que es
// seguro para la app antigua, que comparte esta base de datos. Cuesta algo de espacio y una escritura apenas más lenta.
//
// - CREATE INDEX CONCURRENTLY no bloquea las escrituras de la tabla mientras se crea (por eso esta migración NO usa una
//   transacción: PostgreSQL no permite CONCURRENTLY dentro de una). sequelize-cli no las abre por su cuenta.
// - Es segura de repetir y de correr en cualquier entorno: por cada columna revisa, en ese momento, que la tabla y la
//   columna existan y que no haya ya un índice que empiece por ella; si es así, la salta.
// - Si una ejecución se interrumpe a mitad, PostgreSQL deja un índice INVÁLIDO: esta migración lo borra y lo recrea.
// - Las columnas de auditoría (usuario_creacion/modificacion/eliminacion) no se indexan: no se consultan por ellas.
// - `down` borra solo los índices con el nombre idx_<tabla>_<columna> creados aquí.

const COLUMNS = [
  ['activacion', 'id_campana'],
  ['activacion', 'id_categoria'],
  ['activacion', 'id_empresa'],
  ['anuncios', 'report_id'],
  ['campanas', 'id_categoria'],
  ['campanas', 'id_usuario'],
  ['categorias', 'id_empresa'],
  ['categorias', 'id_usuario'],
  ['clientes', 'id_empresa'],
  ['clientes', 'id_usuario'],
  ['contratos', 'id_empresa'],
  ['empresas', 'id_usuario'],
  ['empresas_scripts', 'id_empresa'],
  ['fecha_actualizacion', 'id_reporte'],
  ['funnel_stage', 'id_reporte'],
  ['gantt_stages_service', 'campaign_id'],
  ['gantt_stages_service', 'empresa_id'],
  ['gantt_stages_service', 'user_id'],
  ['grupo_empresas', 'id_empresa'],
  ['grupo_scripts', 'id_empresa'],
  ['interaccion_dia', 'id_reporte'],
  ['interaccion_dispositivo', 'id_reporte'],
  ['interaccion_edad', 'id_reporte'],
  ['interaccion_genero', 'id_reporte'],
  ['interaccion_hora', 'id_reporte'],
  ['mapa_argentina', 'id_reporte'],
  ['mapa_bolivia', 'id_reporte'],
  ['mapa_ecuador', 'id_reporte'],
  ['mapa_ontario_gta', 'id_reporte'],
  ['mapa_paraguay', 'id_reporte'],
  ['mapa_usa', 'id_reporte'],
  ['metricas', 'id_campana'],
  ['reporte_objetivos_secundarios', 'id_reporte'],
  ['reportes', 'id_campana'],
  ['reportes', 'id_usuario'],
  ['section_funnel', 'id_reporte'],
  ['section_respaldo_plataforma', 'id_reporte'],
  ['section_views', 'id_reporte'],
  ['section_views_dia', 'id_reporte'],
  ['segmentacion', 'id_reporte'],
  ['seguimiento_docs', 'id_campana'],
  ['seguimiento_docs', 'id_usuario'],
  ['seguimiento_messages', 'id_reporte'],
  ['seguimiento_messages', 'id_usuario'],
  ['seguimiento_notes', 'id_reporte'],
  ['seguimiento_notes', 'id_usuario'],
  ['seguimiento_payment', 'id_campana'],
  ['seguimiento_payment', 'id_usuario'],
  ['tasks_activities', 'responsible_id'],
  ['tasks_card_responsibles', 'responsible_id'],
  ['tasks_cards', 'report_id'],
  ['tasks_cards', 'user_id'],
  ['usuarios_secciones', 'id_usuario'],
  ['view_ads', 'id_reporte'],
];

const indexName = (table, column) => `idx_${table}_${column}`;

module.exports = {
  async up(queryInterface) {
    const sequelize = queryInterface.sequelize;
    const query = (sql, replacements) => sequelize.query(sql, { replacements, type: sequelize.QueryTypes.SELECT });
    let created = 0;
    let skipped = 0;

    for (const [table, column] of COLUMNS) {
      const [exists] = await query(
        `SELECT 1 AS ok FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = :table AND column_name = :column`,
        { table, column }
      );
      if (!exists) {
        skipped += 1;
        continue; // la tabla o la columna no existe en este entorno
      }

      // ¿ya hay un índice VÁLIDO cuya primera columna sea esta? (cubre las consultas por esa columna)
      const [indexed] = await query(
        `SELECT 1 AS ok
           FROM pg_index i
           JOIN pg_class t ON t.oid = i.indrelid
           JOIN pg_namespace n ON n.oid = t.relnamespace
           JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = i.indkey[0]
          WHERE n.nspname = 'public' AND t.relname = :table AND a.attname = :column AND i.indisvalid`,
        { table, column }
      );
      if (indexed) {
        skipped += 1;
        continue;
      }

      // Un intento anterior interrumpido deja un índice inválido con este nombre: se borra antes de recrearlo.
      await sequelize.query(`DROP INDEX CONCURRENTLY IF EXISTS "${indexName(table, column)}"`);
      await sequelize.query(
        `CREATE INDEX CONCURRENTLY IF NOT EXISTS "${indexName(table, column)}" ON "${table}" ("${column}")`
      );
      created += 1;
    }

    console.log(`Índices de relaciones: ${created} creados, ${skipped} omitidos (ya existían o no aplican).`);
  },

  async down(queryInterface) {
    const sequelize = queryInterface.sequelize;
    for (const [table, column] of COLUMNS) {
      await sequelize.query(`DROP INDEX CONCURRENTLY IF EXISTS "${indexName(table, column)}"`);
    }
  },
};
