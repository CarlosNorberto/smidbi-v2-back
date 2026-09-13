'use strict';
module.exports = (sequelize, DataTypes) => {
    const QualifyBrief = sequelize.define('qualify_brief', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        id_brief: DataTypes.INTEGER,
        q1: DataTypes.INTEGER,
        q2: DataTypes.INTEGER,
        q3: DataTypes.INTEGER,
        q4: DataTypes.INTEGER,
        qualify: DataTypes.INTEGER,
        fecha_creacion: DataTypes.DATE,
        usuario_creacion: DataTypes.INTEGER,
        fecha_modificacion: DataTypes.DATE,
        usuario_modificacion: DataTypes.INTEGER
    }, {
        schema: 'public',
        timestamps: false,
        tableName: 'qualify_brief'
    });
    return QualifyBrief;
};
