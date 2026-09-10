module.exports = (sequelize, DataTypes) => {
    const ReporteObjetivosSecundarios = sequelize.define('reporte_objetivos_secundarios', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        id_reporte: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        id_objetivo: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        valor: {
            type: DataTypes.BIGINT,
            defaultValue: 0
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        }
    }, {
        tableName: 'reporte_objetivos_secundarios',
        timestamps: false
    });

    ReporteObjetivosSecundarios.associate = (models) => {
        ReporteObjetivosSecundarios.belongsTo(models.objetivos, {
            foreignKey: 'id_objetivo',
            as: 'objetivo'
        });
    };

    return ReporteObjetivosSecundarios;
};
