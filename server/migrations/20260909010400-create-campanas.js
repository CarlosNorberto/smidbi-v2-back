'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('campanas', {
    id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
    id_categoria: {
      type: Sequelize.BIGINT,
      allowNull: false,
      references: { model: 'categorias', key: 'id' },
    },
    nombre: { type: Sequelize.STRING(200), allowNull: false },
    descripcion: { type: Sequelize.STRING(500), allowNull: true },
    activo: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    usuario_creacion: { type: Sequelize.INTEGER, allowNull: false },
    usuario_modificacion: { type: Sequelize.INTEGER, allowNull: true },
    usuario_eliminacion: { type: Sequelize.INTEGER, allowNull: true },
    gestion: { type: Sequelize.BIGINT, allowNull: false },
    fecha_creacion: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
    fecha_modificacion: { type: Sequelize.DATE, allowNull: true },
    fecha_eliminacion: { type: Sequelize.DATE, allowNull: true },
    mes: { type: Sequelize.STRING(10), allowNull: true },
    sesiones: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    conversiones: { type: Sequelize.BIGINT, allowNull: true, defaultValue: 0 },
    id_usuario: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 1 },
    impuestos: { type: Sequelize.DECIMAL(6, 2), allowNull: true, defaultValue: 0 },
    mark_up: { type: Sequelize.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
    mark_up_percent: { type: Sequelize.INTEGER, allowNull: true, defaultValue: 0 },
    reajuste: { type: Sequelize.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
    etiqueta_reajuste: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'Ajuste sobre costo' },
    logo: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: true },
    moneda: { type: Sequelize.STRING(20), allowNull: false, defaultValue: '$us' },
    tipo_reporte: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
    etiqueta_imp_costos_finan: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'Impuestos y costos financieros' },
    etiqueta_sesiones: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'Sesiones' },
    etiqueta_conversiones: { type: Sequelize.STRING(100), allowNull: true, defaultValue: 'Conversiones' },
    copy_from: { type: Sequelize.INTEGER, allowNull: true },
    pagado: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    servicio: { type: Sequelize.STRING(100), allowNull: true },
    fecha_inicio_servicio: { type: Sequelize.DATEONLY, allowNull: true },
    fecha_entrega_servicio: { type: Sequelize.DATEONLY, allowNull: true },
    total_facturado_servicio: { type: Sequelize.DECIMAL(10, 2), allowNull: true, defaultValue: 0 },
    plataforma_servicio: { type: Sequelize.STRING(100), allowNull: true },
    plataforma_servicio_name: { type: Sequelize.STRING(200), allowNull: true },
    url_reporte_externo: { type: Sequelize.TEXT, allowNull: true },
    gantt_observations: { type: Sequelize.TEXT, allowNull: true },
    gantt_learning: { type: Sequelize.TEXT, allowNull: true },
    looker_studio_enabled: { type: Sequelize.BOOLEAN, allowNull: true, defaultValue: false },
    looker_studio_token: { type: Sequelize.STRING, allowNull: true },
  });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('campanas');
  },
};
