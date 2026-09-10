module.exports = (sequelize, DataTypes) => {
    const Objetivos = sequelize.define('objetivos', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        objetivo: {
            type: DataTypes.STRING(150),
            allowNull: false
        },
        activo: {
            type: DataTypes.BOOLEAN,
            defaultValue: true
        },
        usuario_creacion: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        fecha_creacion: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW
        },
        usuario_modificacion: {
            type: DataTypes.INTEGER
        },
        fecha_modificacion: {
            type: DataTypes.DATE
        },
        usuario_eliminacion: {
            type: DataTypes.INTEGER
        },
        fecha_eliminacion: {
            type: DataTypes.DATE
        },
        kpi_sec: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        }
    },{
        tableName: 'objetivos',
        timestamps: false,        
    });

    return Objetivos;
};