module.exports = (sequelize, DataTypes) => {
    const Plataformas = sequelize.define('plataformas', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        plataforma: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
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
        icono: {
            type: DataTypes.STRING(200),
            allowNull: true
        },
        code: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'plataformas',
        timestamps: false
    });

    return Plataformas;
};