'use strict';

// Número de WhatsApp de atención que muestra el home público. Se siembra con el número que ya
// usaba el sitio; después se edita en Administración > Configuraciones > Notificaciones WhatsApp.
module.exports = {
  async up (queryInterface) {
    await queryInterface.sequelize.query(`
      INSERT INTO system_settings (module, key, value, description, active, created_at)
      VALUES ('contacto', 'whatsapp_publico', '{"telefono": "59177495009"}'::jsonb,
              'Número de WhatsApp de contacto para SMID BI: se muestra como icono en la página de inicio', true, NOW())
      ON CONFLICT (module, key) DO NOTHING;
    `);
  },

  async down (queryInterface) {
    await queryInterface.sequelize.query(
      `DELETE FROM system_settings WHERE module = 'contacto' AND key = 'whatsapp_publico';`
    );
  },
};
