// CREATE TABLE public.mapa_bolivia (
// 	id int4 DEFAULT nextval('interaccion_ciudad_id_seq'::regclass) NOT NULL,
// 	id_reporte int4 NOT NULL,
// 	lapaz int8 DEFAULT 0 NULL,
// 	santacruz int8 DEFAULT 0 NULL,
// 	cochabamba int8 DEFAULT 0 NULL,
// 	oruro int8 DEFAULT 0 NULL,
// 	tarija int8 DEFAULT 0 NULL,
// 	pando int8 DEFAULT 0 NULL,
// 	beni int8 DEFAULT 0 NULL,
// 	sucre int8 DEFAULT 0 NULL,
// 	potosi int8 DEFAULT 0 NULL,
// 	activo bool DEFAULT true NULL,
// 	usuario_creacion int4 NOT NULL,
// 	fecha_creacion timestamp DEFAULT now() NOT NULL,
// 	usuario_modificacion int4 NULL,
// 	fecha_modificacion timestamp NULL,
// 	usuario_eliminacion int4 NULL,
// 	fecha_eliminacion timestamp NULL,
// 	CONSTRAINT interaccion_ciudad_pkey PRIMARY KEY (id),
// 	CONSTRAINT mapa_bolivia_reportes_fk FOREIGN KEY (id_reporte) REFERENCES public.reportes(id) ON DELETE CASCADE
// );
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