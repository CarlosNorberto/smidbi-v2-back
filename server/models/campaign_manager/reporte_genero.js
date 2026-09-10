module.exports = (sequelize, DataTypes) => {
    const ReporteGenero = sequelize.define('interaccion_genero', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        porcentaje: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        genero: {
            type: DataTypes.STRING(100),
            defaultValue: 'hombres',
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        usuario_creacion: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        fecha_creacion: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false,
        },
        usuario_modificacion: {
            type: DataTypes.INTEGER,
        },
        fecha_modificacion: {
            type: DataTypes.DATE,
        },
        usuario_eliminacion: {
            type: DataTypes.INTEGER,
        },
        fecha_eliminacion: {
            type: DataTypes.DATE,
        },
        id_reporte: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
    }, {
        tableName: 'interaccion_genero',
        timestamps: false,
    });

    return ReporteGenero;
};
