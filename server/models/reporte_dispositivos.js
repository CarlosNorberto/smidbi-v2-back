module.exports = (sequelize, DataTypes) => {
    const ReporteDispositivos = sequelize.define('interaccion_dispositivo', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        porcentaje_tablet: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        porcentaje_smartphone: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        porcentaje_laptop: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        activo: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        usuario_creacion: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        fecha_creacion: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
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
        },        
    }, {
        tableName: 'interaccion_dispositivo',
        timestamps: false
    });
    return ReporteDispositivos;
}