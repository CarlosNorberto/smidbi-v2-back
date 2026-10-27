'use strict';

// Enlace de TikTok en el brief (formulario público). Antes la app solo tenía YouTube (y a veces se usaba ese campo para
// TikTok). Columna opcional (NULL): no afecta a la app antigua, que comparte la tabla.
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('request_brief', 'url_tiktok', { type: Sequelize.STRING(200), allowNull: true });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('request_brief', 'url_tiktok');
  },
};
