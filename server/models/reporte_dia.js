module.exports = (sequelize, DataTypes) => {
    const ReporteDia = sequelize.define('reporte_dia', {
        id: {
          type:DataTypes.INTEGER,
          primaryKey:true,
          autoIncrement:true
        },
        id_reporte:DataTypes.INTEGER,
        valor:DataTypes.INTEGER,
        dia:DataTypes.INTEGER,
        mes:DataTypes.INTEGER,
        anio:DataTypes.INTEGER,
        fecha_creacion:DataTypes.DATE,
        usuario_creacion:DataTypes.INTEGER,
        fecha_modificacion:DataTypes.DATE,
        usuario_modificacion:DataTypes.INTEGER,
        id_objetivo:DataTypes.INTEGER,
        media_cost:DataTypes.NUMERIC(12,2),
        rango_edad:DataTypes.INTEGER,
        genero:DataTypes.INTEGER,
    }, {
        tableName:"reporte_dia",
        timestamps:false,
    });
    
    ReporteDia.associate = (models) => {
        ReporteDia.belongsTo(models.reportes, {
            foreignKey: 'id_reporte',
            as: 'reportes'
        });
        // ReporteDia.belongsTo(models.objetivos, {
        //     foreignKey: 'id_objetivo',
        //     as: 'objetivos'
        // });
    };

    return ReporteDia;
};