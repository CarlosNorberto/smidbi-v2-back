'use strict';
module.exports = (sequelize, DataTypes) => {
    const CostoPor = sequelize.define('costo_por', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            unique: true
        },
        id_plataforma: DataTypes.INTEGER,
        tipo: DataTypes.STRING,
        nombre: DataTypes.STRING,
        grupo: DataTypes.INTEGER,
        costo: DataTypes.NUMERIC(4, 2),
        activo: DataTypes.BOOLEAN,
        fecha_creacion: DataTypes.DATE,
        usuario_creacion: DataTypes.INTEGER,
        fecha_modificacion: DataTypes.DATE,
        usuario_modificacion: DataTypes.INTEGER
    }, {
        schema: 'public',
        timestamps: false,
        tableName: 'costo_por'
    });
    CostoPor.associate = (models) => {
        CostoPor.belongsTo(models.plataformas, {
            foreignKey: 'id_plataforma',
            as: 'plataforma',
        });
    };
    return CostoPor;
};
