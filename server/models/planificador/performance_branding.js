'use strict';
module.exports = (sequelize, DataTypes) => {
    const PerformanceBranding = sequelize.define('performance_branding', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        id_brief: { type: DataTypes.INTEGER, allowNull: false },
        id_plataforma: { type: DataTypes.INTEGER, allowNull: false },
        tipo: { type: DataTypes.STRING, allowNull: false },
        nombre: { type: DataTypes.STRING, allowNull: false },
        grupo: { type: DataTypes.INTEGER, allowNull: false },
        id_costo: { type: DataTypes.INTEGER, allowNull: true },
        costo: { type: DataTypes.DECIMAL(4, 2), allowNull: false },
        objetivo: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        inversion: { type: DataTypes.DECIMAL(10, 2), allowNull: false },
        kpi_principal: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        kpi_secundario: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        frecuencia: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        usuario_creacion: { type: DataTypes.INTEGER, allowNull: false },
        fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        usuario_modificacion: { type: DataTypes.INTEGER, allowNull: true },
        fecha_modificacion: { type: DataTypes.DATE, allowNull: true },
    }, {
        schema: 'public',
        timestamps: false,
        tableName: 'performance_branding',
    });

    PerformanceBranding.associate = (models) => {
        PerformanceBranding.belongsTo(models.request_brief, { foreignKey: 'id_brief', as: 'request_brief' });
        PerformanceBranding.belongsTo(models.plataformas, { foreignKey: 'id_plataforma', as: 'plataforma' });
    };

    return PerformanceBranding;
};
