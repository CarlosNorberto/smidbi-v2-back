module.exports = (sequelize, DataTypes) => {
    const Categorias = sequelize.define('categorias', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombre: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        descripcion: {
            type: DataTypes.STRING(300),
            allowNull: true
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
        usuario_modificacion: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        usuario_eliminacion: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        id_cliente: {
            type: DataTypes.BIGINT,
            allowNull: true
        },
        fecha_creacion: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: false
        },
        fecha_modificacion: {
            type: DataTypes.DATE,
            allowNull: true
        },
        fecha_eliminacion: {
            type: DataTypes.DATE,
            allowNull: true
        },
        id_usuario: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            allowNull: false
        },
        id_empresa: {
            type: DataTypes.BIGINT,
            allowNull: false
        }
    }, {
        tableName: 'categorias',
        timestamps: false
    });

    return Categorias;
};
