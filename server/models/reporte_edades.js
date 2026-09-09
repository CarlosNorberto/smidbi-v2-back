module.exports = (sequelize, DataTypes) => {
    const ReporteEdades = sequelize.define('interaccion_edad', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        porcentaje1: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        porcentaje2: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        porcentaje3: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        porcentaje4: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        porcentaje5: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        porcentaje6: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        porcentaje7: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        porcentaje0: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
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
            defaultValue: DataTypes.NOW,
            allowNull: false
        },
        usuario_modificacion: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        fecha_modificacion: {
            type: DataTypes.DATE,
            allowNull: true
        },
        usuario_eliminacion: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        fecha_eliminacion: {
            type: DataTypes.DATE,
            allowNull: true
        },
        id_reporte: {
            type: DataTypes.INTEGER,
            allowNull: false
        }
    }, {
        tableName: 'interaccion_edad',
        timestamps: false,
        schema: 'public'
    });

    return ReporteEdades;
}