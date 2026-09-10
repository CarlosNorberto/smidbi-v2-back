module.exports = (sequelize, DataTypes) => {
    const Reportes = sequelize.define(
        'reportes',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            nombre: {
                type: DataTypes.STRING(200),
                allowNull: false,
                index: true,
            },
            id_campana: {
                type: DataTypes.INTEGER,
                allowNull: false,
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
                allowNull: true,
            },
            fecha_modificacion: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            usuario_eliminacion: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            fecha_eliminacion: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            presupuesto: {
                type: DataTypes.NUMERIC,
                allowNull: true,
            },
            objetivo_proyectado: {
                type: DataTypes.NUMERIC,
                allowNull: true,
            },
            id_plataforma: {
                type: DataTypes.INTEGER,
                defaultValue: 1,
                allowNull: false,
            },
            id_objetivo: {
                type: DataTypes.INTEGER,
                defaultValue: 1,
                allowNull: false,
            },
            fecha_inicio: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: true,
            },
            fecha_final: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: true,
            },
            fecha_ini: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },
            fecha_fin: {
                type: DataTypes.DATEONLY,
                allowNull: true,
            },
            sesiones: {
                type: DataTypes.BIGINT,
                defaultValue: 0,
            },
            conversiones: {
                type: DataTypes.BIGINT,
                defaultValue: 0,
            },
            cp: {
                type: DataTypes.NUMERIC(8, 4),
                defaultValue: 0,
            },
            funnel: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            id_usuario: {
                type: DataTypes.INTEGER,
                defaultValue: 1,
                allowNull: false,
            },
            id_mapa: {
                type: DataTypes.INTEGER,
                defaultValue: 1,
                allowNull: false,
            },
            link: {
                type: DataTypes.STRING(300),
                allowNull: true,
            },
            link_w: {
                type: DataTypes.NUMERIC(6, 2),
                defaultValue: 0,
            },
            link_h: {
                type: DataTypes.NUMERIC(6, 2),
                defaultValue: 0,
            },
            order: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
            },
            id_campaign: {
                type: DataTypes.STRING(50),
                allowNull: true,
            },
            ejecutado: {
                type: DataTypes.NUMERIC(12, 2),
                defaultValue: 0,
            },
            seguimiento_finalizado: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            porc_plataforma: {
                type: DataTypes.NUMERIC(4, 2),
                defaultValue: 0.3,
            },
            seguimiento_activo: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
            },
            estado_pauta: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            pagado: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            cr_objetivo_one: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            cr_objetivo_two: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            diferencia_seg: {
                type: DataTypes.NUMERIC(12, 2),
                allowNull: true,
            },
            ejecutado_seg: {
                type: DataTypes.NUMERIC(12, 2),
                allowNull: true,
            },
            frecuency_objetivo_one: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            frecuency_objetivo_two: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            has_excel_ads: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
            },
            ctr: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            frecuencia: {
                type: DataTypes.FLOAT,
                defaultValue: 0,
            },
            cta_title: {
                type: DataTypes.STRING,
                allowNull: true,
            },
        },
        {
            tableName: 'reportes',
            timestamps: false,
        },
    );

    Reportes.associate = (models) => {
        Reportes.belongsTo(models.campanas, {
            foreignKey: 'id_campana',
            as: 'campana',
        });
        Reportes.belongsTo(models.plataformas, {
            foreignKey: 'id_plataforma',
            as: 'plataforma',
        });
        Reportes.belongsTo(models.objetivos, {
            foreignKey: 'id_objetivo',
            as: 'objetivo',
        });
        Reportes.hasMany(models.reporte_dia, {
            foreignKey: 'id_reporte',
            as: 'reporte_dia',
        });
        Reportes.hasMany(models.reporte_objetivos_secundarios, {
            foreignKey: 'id_reporte',
            as: 'objetivos_secundarios',
        });
        Reportes.hasOne(models.mapa_bolivia, {
            foreignKey: 'id_reporte',
            as: 'mapa_bolivia',
        });
        Reportes.hasOne(models.interaccion_dispositivo, {
            foreignKey: 'id_reporte',
            as: 'dispositivos',
        });
        Reportes.hasOne(models.interaccion_edad, {
            foreignKey: 'id_reporte',
            as: 'edades',
        });
        Reportes.hasOne(models.interaccion_hora, {
            foreignKey: 'id_reporte',
            as: 'horas',
        });
        Reportes.hasMany(models.interaccion_genero, {
            foreignKey: 'id_reporte',
            as: 'generos',
        });
        Reportes.hasOne(models.segmentacion, {
            foreignKey: 'id_reporte',
            as: 'segmentacion',
        });
        Reportes.hasMany(models.funnel_stage, {
            foreignKey: 'id_reporte',
            as: 'funnel_stage',
        });
        Reportes.hasMany(models.view_ads, {
            foreignKey: 'id_reporte',
            as: 'view_ads',
        });

        // Scopes
        Reportes.addScope('withCampaign', {
            include: [
                {
                    model: models.campanas,
                    as: 'campana',
                    attributes: [
                        'id',
                        'nombre',
                        'descripcion',
                        'mes',
                        'gestion',
                        'moneda',
                    ],
                },
            ],
        });
        Reportes.addScope('withPlatform', {
            include: [
                {
                    model: models.plataformas,
                    as: 'plataforma',
                    attributes: ['id', 'plataforma', 'icono', 'code'],
                },
            ],
        });
        Reportes.addScope('withObjectives', {
            include: [
                {
                    model: models.objetivos,
                    as: 'objetivo',
                    attributes: {
                        exclude: [
                            'usuario_creacion',
                            'usuario_modificacion',
                            'usuario_eliminacion',
                            'fecha_creacion',
                            'fecha_modificacion',
                            'fecha_eliminacion',
                        ],
                    },
                },
            ],
        });
        Reportes.addScope('withSecondaryObjectives', {
            include: [
                {
                    model: models.reporte_objetivos_secundarios,
                    as: 'objetivos_secundarios',
                    attributes: ['id', 'id_objetivo', 'valor', 'activo'],
                },
            ],
        });
        Reportes.addScope('withDailyReport', {
            include: [
                {
                    model: models.reporte_dia,
                    as: 'reporte_dia',
                    attributes: [
                        'id',
                        'valor',
                        'dia',
                        'mes',
                        'anio',
                        'id_objetivo',
                    ],
                },
            ],
        });
        Reportes.addScope('withMapBolivia', {
            include: [
                {
                    model: models.mapa_bolivia,
                    as: 'mapa_bolivia',
                    attributes: [
                        'id',
                        'lapaz',
                        'santacruz',
                        'cochabamba',
                        'oruro',
                        'tarija',
                        'pando',
                        'beni',
                        'sucre',
                        'potosi',
                    ],
                },
            ],
        });
        Reportes.addScope('withDevices', {
            include: [
                {
                    model: models.interaccion_dispositivo,
                    as: 'dispositivos',
                    attributes: [
                        'id',
                        'porcentaje_tablet',
                        'porcentaje_smartphone',
                        'porcentaje_laptop',
                    ],
                },
            ],
        });
        Reportes.addScope('withAges', {
            include: [
                {
                    model: models.interaccion_edad,
                    as: 'edades',
                    attributes: [
                        'id',
                        'porcentaje1',
                        'porcentaje2',
                        'porcentaje3',
                        'porcentaje4',
                        'porcentaje5',
                        'porcentaje6',
                        'porcentaje7',
                        'porcentaje0',
                    ],
                },
            ],
        });
        Reportes.addScope('withHours', {
            include: [
                {
                    model: models.interaccion_hora,
                    as: 'horas',
                    attributes: [
                        'id',
                        'h1',
                        'h2',
                        'h3',
                        'h4',
                        'h5',
                        'h6',
                        'h7',
                        'h8',
                        'h9',
                        'h10',
                        'h11',
                        'h12',
                        'h13',
                        'h14',
                        'h15',
                        'h16',
                        'h17',
                        'h18',
                        'h19',
                        'h20',
                        'h21',
                        'h22',
                        'h23',
                        'h24',
                    ],
                },
            ],
        });
        Reportes.addScope('withGenders', {
            include: [
                {
                    model: models.interaccion_genero,
                    as: 'generos',
                    attributes: ['id', 'porcentaje', 'genero'],
                },
            ],
        });
        Reportes.addScope('withSegmentation', {
            include: [
                {
                    model: models.segmentacion,
                    as: 'segmentacion',
                    attributes: [
                        'id',
                        'segmentacion',
                        'demografia',
                        'geo_segmentacion',
                        'retargeting',
                        'learning',
                        'palabras_clave',
                    ],
                },
            ],
        });
        Reportes.addScope('withFunnelStage', {
            include: [
                {
                    model: models.funnel_stage,
                    as: 'funnel_stage',
                    attributes: [
                        'id',
                        'punto1',
                        'punto2',
                        'punto3',
                        'punto4',
                        'activo',
                    ],
                },
            ],
        });
        Reportes.addScope('withViewAds', {
            include: [
                {
                    model: models.view_ads,
                    as: 'view_ads',
                    attributes: [
                        'id',
                        'imagen',
                        'link_end_point',
                        'title',
                        'image_url',
                    ],
                },
            ],
        });
    };

    return Reportes;
};
