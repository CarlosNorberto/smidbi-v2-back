'use strict';
module.exports = (sequelize, DataTypes) => {
    const Summary = sequelize.define('summary', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        id_brief: { type: DataTypes.INTEGER, allowNull: false },
        tipo: { type: DataTypes.STRING, allowNull: false },
        id_costo: { type: DataTypes.INTEGER, allowNull: false },
        summary_meses: { type: DataTypes.JSONB, allowNull: true },
        grupo: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
        usuario_creacion: { type: DataTypes.INTEGER, allowNull: false },
        fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        usuario_modificacion: { type: DataTypes.INTEGER, allowNull: true },
        fecha_modificacion: { type: DataTypes.DATE, allowNull: true },
    }, {
        schema: 'public',
        timestamps: false,
        tableName: 'summary',
    });

    return Summary;
};
