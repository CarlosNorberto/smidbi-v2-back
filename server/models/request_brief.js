'use strict';
module.exports = (sequelize, DataTypes) => {
    const RequestBrief = sequelize.define('request_brief', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombre_empresa: DataTypes.STRING,
        nombre_campana: DataTypes.STRING,
        responsable: DataTypes.STRING,
        mail: DataTypes.STRING,
        telefono: DataTypes.STRING,
        descripcion: DataTypes.STRING,
        url: DataTypes.STRING,
        url_destino: DataTypes.STRING,
        url_fanpage: DataTypes.STRING,
        url_youtube: DataTypes.STRING,
        url_twitter: DataTypes.STRING,
        url_descarga_app: DataTypes.STRING,
        competencia_directa: DataTypes.STRING,
        recursos_graficos: DataTypes.BOOLEAN,
        recursos_audiovisuales: DataTypes.BOOLEAN,
        slogan: DataTypes.STRING,
        fecha_inicio: DataTypes.DATE,
        fecha_fin: DataTypes.DATE,
        presupuesto: DataTypes.DECIMAL(10, 2),
        geolocalizacion: DataTypes.STRING,
        geolocalizacion_ciudad: DataTypes.ARRAY(DataTypes.STRING),
        segmentacion_edad: DataTypes.ARRAY(DataTypes.STRING),
        segmentacion_sexo: DataTypes.ARRAY(DataTypes.STRING),
        intereses: DataTypes.ARRAY(DataTypes.STRING),
        medios: DataTypes.ARRAY(DataTypes.STRING),
        reviewed: DataTypes.BOOLEAN,
        fecha_creacion: DataTypes.DATE,
        usuario_modificacion: DataTypes.INTEGER,
        fecha_modificacion: DataTypes.DATE,
        moneda: DataTypes.STRING,
        funnel_stage_1: DataTypes.BOOLEAN,
        funnel_stage_2: DataTypes.BOOLEAN,
        funnel_stage_3: DataTypes.BOOLEAN,
        funnel_stage_4: DataTypes.BOOLEAN,
        url_linkedin: DataTypes.STRING,
        url_instagram: DataTypes.STRING,
        comments: DataTypes.TEXT,
        copia_from: DataTypes.INTEGER,
        estrategia: DataTypes.TEXT,
    }, {
        schema: 'public',
        timestamps: false,
        tableName: 'request_brief'
    });

    RequestBrief.associate = (models) => {
        RequestBrief.hasOne(models.qualify_brief, {
            foreignKey: 'id_brief',
            as: 'qualify_brief',
        });
        RequestBrief.hasMany(models.performance_branding, {
            foreignKey: 'id_brief',
            as: 'performance_branding',
        });
    };

    return RequestBrief;
};
