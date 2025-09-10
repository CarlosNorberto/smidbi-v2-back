const bcrypt = require('bcrypt');

module.exports = (sequelize, DataTypes) => {
    const Users = sequelize.define('usuarios', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombre: {
            type: DataTypes.STRING(200),
            allowNull: false
        },
        usuario: {
            type: DataTypes.STRING(100),
            allowNull: false
        },
        password: {
            type: DataTypes.STRING(100),
            allowNull: false
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
        padre: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false
        },
        email: {
            type: DataTypes.STRING(50),
            allowNull: false
        },
        dependientes: {
            type: DataTypes.ARRAY(DataTypes.INTEGER),
            allowNull: true
        },
        time_zone: {
            type: DataTypes.STRING,
            allowNull: true
        },
        phone: {
            type: DataTypes.STRING(30),
            allowNull: true
        }
    }, {
        tableName: 'usuarios',
        timestamps: false
    });

    Users.prototype.validPassword = function (password) {
        if (!this.password) return false;
        return bcrypt.compareSync(password, this.password);
    }

    return Users;
}