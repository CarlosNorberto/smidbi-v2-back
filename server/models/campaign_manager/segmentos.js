module.exports = (sequelize, DataTypes) => {
    const Segmentacion = sequelize.define('segmentacion', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        id_reporte: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        usuario_creacion: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        fecha_creacion: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        usuario_modificacion: {
            type: DataTypes.INTEGER
        },
        fecha_modificacion: {
            type: DataTypes.DATE
        },
        usuario_eliminacion: {
            type: DataTypes.INTEGER
        },
        fecha_eliminacion: {
            type: DataTypes.DATE
        },
        segmentacion: {
            type: DataTypes.ARRAY(DataTypes.STRING)
        },
        demografia: {
            type: DataTypes.ARRAY(DataTypes.STRING)
        },
        geo_segmentacion: {
            type: DataTypes.ARRAY(DataTypes.STRING)
        },
        retargeting: {
            type: DataTypes.ARRAY(DataTypes.STRING)
        },
        learning: {
            type: DataTypes.ARRAY(DataTypes.STRING)
        },
        palabras_clave: {
            type: DataTypes.ARRAY(DataTypes.STRING)
        }
    }, {
        tableName: 'segmentacion',
        timestamps: false
    });

    return Segmentacion;
};
