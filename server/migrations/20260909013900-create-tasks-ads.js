'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('tasks_ads', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    card_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'tasks_cards', key: 'id' },
    },
    date_start: { type: Sequelize.DATEONLY, allowNull: true },
    date_end: { type: Sequelize.DATEONLY, allowNull: true },
    cities: { type: Sequelize.TEXT, allowNull: true },
    ages: { type: Sequelize.TEXT, allowNull: true },
    investment: { type: Sequelize.FLOAT, allowNull: true },
    sexes: { type: Sequelize.TEXT, allowNull: true },
    target: { type: Sequelize.INTEGER, allowNull: true },
    segmentation: { type: Sequelize.TEXT, allowNull: true },
    material_links: { type: Sequelize.TEXT, allowNull: true },
    platform_links: { type: Sequelize.TEXT, allowNull: true },
    cta_ad: { type: Sequelize.TEXT, allowNull: true },
    seg_cities: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
    seg_ages: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
    seg_sexes: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
    seg_segmentations: { type: Sequelize.ARRAY(Sequelize.STRING), allowNull: true },
    seg_flag: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('tasks_ads');
  },
};
