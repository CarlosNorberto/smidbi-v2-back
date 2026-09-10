'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'prospects', schema: 'lead_manager' }, {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    country: { type: Sequelize.STRING, allowNull: true },
    city: { type: Sequelize.STRING, allowNull: true },
    name: { type: Sequelize.STRING, allowNull: true },
    position: { type: Sequelize.STRING, allowNull: true },
    email: { type: Sequelize.STRING, allowNull: true },
    phone: { type: Sequelize.STRING, allowNull: true },
    web_page: { type: Sequelize.STRING, allowNull: true },
    client: { type: Sequelize.STRING, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable({ tableName: 'prospects', schema: 'lead_manager' });
  },
};
