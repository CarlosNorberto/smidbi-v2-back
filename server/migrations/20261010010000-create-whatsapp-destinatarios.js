'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    // Números de WhatsApp a los que el sistema envía avisos. Cada número se asocia a uno o más
    // "procesos" (ver server/config/whatsapp_procesos.js): solo recibe los avisos de esos procesos.
    await queryInterface.createTable('whatsapp_destinatarios', {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true },
      nombre: { type: Sequelize.STRING(120), allowNull: false },
      // Solo dígitos, con código de país y sin '+' (ej. 59167146124): es el formato que pide la API de Meta.
      telefono: { type: Sequelize.STRING(15), allowNull: false, unique: true },
      procesos: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: false, defaultValue: [] },
      activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('whatsapp_destinatarios');
  },
};
