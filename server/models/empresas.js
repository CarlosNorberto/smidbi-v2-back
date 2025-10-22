module.exports = (sequelize, DataTypes) => {
    const Empresas = sequelize.define('empresas', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        nombre: {
            type: DataTypes.STRING(200),
            allowNull: false,
            index: true
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
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        descripcion: {
            type: DataTypes.STRING(300),
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
        usuario: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        password: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        email: {
            type: DataTypes.STRING(100),
            allowNull: true
        },
        link_aux: {
            type: DataTypes.STRING(200),
            allowNull: true
        },
        id_usuario: {
            type: DataTypes.INTEGER,
            defaultValue: 1,
            allowNull: false
        },
        num_plantilla_contrato: {
            type: DataTypes.INTEGER,
            allowNull: true
        },
        contrato_pdf: {
            type: DataTypes.STRING(200),
            allowNull: true
        },
        code: {
            type: DataTypes.STRING,
            allowNull: true
        },
        link_databi: {
            type: DataTypes.TEXT,
            allowNull: true
        },
        mobile: {
            type: DataTypes.STRING,
            allowNull: true
        }
    }, {
        tableName: 'empresas',
        timestamps: false
    });

    Empresas.associate = function(models) {
        Empresas.belongsTo(models.usuarios, { foreignKey: 'id_usuario', as: 'user' });

        // Scopes
        Empresas.addScope('withUser', {
            include: [
                {
                    model: models.usuarios, 
                    as: 'user',
                    attributes: ['id', 'nombre', 'email']
                }
            ]
        });
    }

    return Empresas;
};
