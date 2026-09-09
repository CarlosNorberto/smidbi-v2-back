module.exports = (sequelize, DataTypes) => {
    const ReporteMapBolivia = sequelize.define('mapa_bolivia', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        id_reporte: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        lapaz: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            allowNull: true
        },
        santacruz: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            allowNull: true
        },
        cochabamba: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            allowNull: true
        },
        oruro: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            allowNull: true
        },
        tarija: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            allowNull: true
        },
        pando: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            allowNull: true
        },
        beni: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            allowNull: true
        },
        sucre: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            allowNull: true
        },
        potosi: {
            type: DataTypes.BIGINT,
            defaultValue: 0,
            allowNull: true
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: true
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
    }, {
        tableName: 'mapa_bolivia',
        timestamps: false
    });
    ReporteMapBolivia.associate = (models) => {
        ReporteMapBolivia.belongsTo(models.reportes, {
            foreignKey: 'id_reporte',
            as: 'reporte'
        });
    };
    return ReporteMapBolivia;
};