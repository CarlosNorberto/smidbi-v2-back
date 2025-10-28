module.exports = (sequelize, DataTypes) => {
    const ReporteViewAds = sequelize.define('view_ads', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        id_reporte: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        imagen: {
            type: DataTypes.STRING,
            allowNull: false
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
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false
        },
        orden: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true
        },
        link_end_point: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        title: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'view_ads',
        timestamps: false
    });
    return ReporteViewAds;
};
