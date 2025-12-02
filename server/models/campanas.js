module.exports = (sequelize, DataTypes) => {
    const Campanas = sequelize.define('campanas', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        id_categoria: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        nombre: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        descripcion: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: false,
        },
        usuario_creacion: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        usuario_modificacion: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        usuario_eliminacion: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        gestion: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        fecha_creacion: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false,
        },
        fecha_modificacion: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        fecha_eliminacion: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        mes: {
            type: DataTypes.STRING(10),
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
        id_usuario: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
        },
        impuestos: {
            type: DataTypes.DECIMAL(6, 2),
            defaultValue: 0,
        },
        mark_up: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        mark_up_percent: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        reajuste: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
        },
        etiqueta_reajuste: {
            type: DataTypes.STRING(100),
            defaultValue: 'Ajuste sobre costo',
            allowNull: true,
        },
        logo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            allowNull: true,
        },
        moneda: {
            type: DataTypes.STRING(20),
            defaultValue: '$us',
            allowNull: false,
        },
        tipo_reporte: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            allowNull: false,
        },
        etiqueta_imp_costos_finan: {
            type: DataTypes.STRING(100),
            defaultValue: 'Impuestos y costos financieros',
            allowNull: true,
        },
        etiqueta_sesiones: {
            type: DataTypes.STRING(100),
            defaultValue: 'Sesiones',
            allowNull: true,
        },
        etiqueta_conversiones: {
            type: DataTypes.STRING(100),
            defaultValue: 'Conversiones',
            allowNull: true,
        },
        copy_from: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        pagado: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true,
        },
        servicio: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        fecha_inicio_servicio: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        fecha_entrega_servicio: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        total_facturado_servicio: {
            type: DataTypes.DECIMAL(10, 2),
            defaultValue: 0,
            allowNull: true,
        },
        plataforma_servicio: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        plataforma_servicio_name: {
            type: DataTypes.STRING(200),
            allowNull: true,
        },
        url_reporte_externo: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        gantt_observations: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        gantt_learning: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        looker_studio_enabled: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true,
        },
        looker_studio_token: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        tableName: 'campanas',
        timestamps: false,
    });

    Campanas.associate = (models) => {
        Campanas.hasMany(models.reportes, {
            foreignKey: 'id_campana',
            as: 'reportes',
        });
        Campanas.belongsTo(models.categorias, {
            foreignKey: 'id_categoria',
            as: 'categoria',
        });
    };
    return Campanas;
}
