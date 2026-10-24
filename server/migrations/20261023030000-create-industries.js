'use strict';

// Rubro o sector de cada prospecto (lead_manager.industries) y su vínculo con lead_manager.prospects.
// Es aditivo: tabla nueva + columna opcional (NULL), así que el sistema anterior no se ve afectado.
// Los rubros iniciales salen de la clasificación de la base de datos comercial de SMID (Excel del 18/02/2026),
// unificando variantes de escritura (p. ej. "Bienes Raices" / "Bienes raices", "Otro" / "otro").
const INDUSTRIES = [
  'Agencias de marketing',
  'Agencias de viajes',
  'Alcaldías y gobernaciones',
  'Aseguradoras',
  'Banca',
  'Bienes raíces',
  'Colegios',
  'Concesionarias de automóviles',
  'Consumo masivo',
  'Delivery',
  'Farmacéutica',
  'Gastronomía',
  'Gimnasios y centros deportivos',
  'Grupo empresarial',
  'Heladerías',
  'Hoteles',
  'Importadoras',
  'Industria de alimentos',
  'Jugueterías',
  'Materiales de construcción',
  'Medios de comunicación',
  'Ministerios',
  'Mueblerías',
  'Repuestos y autopartes',
  'Retail',
  'Salud',
  'Servicios legales',
  'Supermercados',
  'Tecnología',
  'Universidades',
  'Otro',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable({ tableName: 'industries', schema: 'lead_manager' }, {
      id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
      name: { type: Sequelize.STRING(120), allowNull: false, unique: true },
      active: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
    });
    await queryInterface.bulkInsert(
      { tableName: 'industries', schema: 'lead_manager' },
      INDUSTRIES.map((name) => ({ name, active: true })),
    );
    await queryInterface.addColumn({ tableName: 'prospects', schema: 'lead_manager' }, 'industry_id', {
      type: Sequelize.INTEGER,
      allowNull: true,
      references: { model: { tableName: 'industries', schema: 'lead_manager' }, key: 'id' },
      onDelete: 'SET NULL',
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn({ tableName: 'prospects', schema: 'lead_manager' }, 'industry_id');
    await queryInterface.dropTable({ tableName: 'industries', schema: 'lead_manager' });
  },
};
