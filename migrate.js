const { Client } = require('pg');
const { DateTime } = require('luxon');

// Configuración de conexión
const client = new Client({
    host: 'localhost',
    port: 5432,
    user: 'postgres',
    password: 'stephano',
    database: 'smidbi',
});

(async () => {
    try {
        await client.connect();

        console.log('⏳ Obteniendo reportes y zonas horarias de usuarios...');
        const res = await client.query(`
      SELECT r.id, r.fecha_inicio, r.fecha_final, u.time_zone
      FROM reportes r
      JOIN usuarios u ON r.id_usuario = u.id
      WHERE r.fecha_inicio IS NOT NULL OR r.fecha_final IS NOT NULL
    `);

        for (const row of res.rows) {
            const { id, fecha_inicio, fecha_final, time_zone } = row;

            // Conversión segura usando zona horaria del usuario
            const fechaInicioUTC = fecha_inicio
                ? DateTime.fromJSDate(fecha_inicio, { zone: time_zone }).toUTC().toISO()
                : null;

            const fechaFinalUTC = fecha_final
                ? DateTime.fromJSDate(fecha_final, { zone: time_zone }).toUTC().toISO()
                : null;

            await client.query(
                `UPDATE reportes
         SET fecha_inicio = $1, fecha_final = $2
         WHERE id = $3`,
                [fechaInicioUTC, fechaFinalUTC, id]
            );

            console.log(`✅ Reporte ${id} actualizado`);
        }

        console.log('✅ Migración completada. Ahora puedes cambiar el tipo a timestamptz.');
        await client.end();
    } catch (err) {
        console.error('❌ Error en la migración:', err);
        process.exit(1);
    }
})();
