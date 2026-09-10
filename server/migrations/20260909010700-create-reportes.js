'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('reportes', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    nombre: { type: Sequelize.STRING(200), allowNull: false },
    id_campana: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: { model: 'campanas', key: 'id' },
    },
    activo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    presupuesto: { type: Sequelize.DECIMAL, allowNull: true },
    objetivo_proyectado: { type: Sequelize.DECIMAL, allowNull: true },
    id_plataforma: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      references: { model: 'plataformas', key: 'id' },
    },
    id_objetivo: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 1,
      references: { model: 'objetivos', key: 'id' },
    },
    fecha_inicio: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.NOW },
    fecha_final: { type: Sequelize.DATE, allowNull: true, defaultValue: Sequelize.NOW },
    fecha_ini: { type: Sequelize.DATEONLY, allowNull: true },
    fecha_fin: { type: Sequelize.DATEONLY, allowNull: true },
    sesiones: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    conversiones: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    cp: { type: Sequelize.DECIMAL(8, 4), allowNull: true, defaultValue: 0 },
    funnel: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    id_usuario: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    id_mapa: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    link: { type: Sequelize.STRING(300), allowNull: true },
    link_w: { type: Sequelize.DECIMAL(6, 2), allowNull: true, defaultValue: 0 },
    link_h: { type: Sequelize.DECIMAL(6, 2), allowNull: true, defaultValue: 0 },
    order: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    id_campaign: { type: Sequelize.STRING(50), allowNull: true },
    ejecutado: { type: Sequelize.DECIMAL(12, 2), allowNull: true, defaultValue: 0 },
    seguimiento_finalizado: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    porc_plataforma: { type: Sequelize.DECIMAL(4, 2), allowNull: true, defaultValue: 0.3 },
    seguimiento_activo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    estado_pauta: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    pagado: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    cr_objetivo_one: { type: Sequelize.INTEGER, allowNull: true },
    cr_objetivo_two: { type: Sequelize.INTEGER, allowNull: true },
    diferencia_seg: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
    ejecutado_seg: { type: Sequelize.DECIMAL(12, 2), allowNull: true },
    frecuency_objetivo_one: { type: Sequelize.INTEGER, allowNull: true },
    frecuency_objetivo_two: { type: Sequelize.INTEGER, allowNull: true },
    has_excel_ads: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    ctr: { type: Sequelize.FLOAT, allowNull: true, defaultValue: 0 },
    frecuencia: { type: Sequelize.FLOAT, allowNull: true, defaultValue: 0 },
    cta_title: { type: Sequelize.STRING, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('reportes');
  },
};
