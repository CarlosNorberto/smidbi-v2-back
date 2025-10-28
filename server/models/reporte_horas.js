module.exports = (sequelize, DataTypes) => {
    const ReporteHoras = sequelize.define('interaccion_hora', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        id_reporte: {
            type: DataTypes.INTEGER,
            allowNull: false
        },
        h1: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h2: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h3: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h4: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h5: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h6: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h7: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h8: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h9: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h10: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h11: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h12: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h13: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h14: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h15: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h16: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h17: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h18: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h19: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h20: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h21: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h22: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h23: {
            type: DataTypes.DECIMAL(4,1),
            defaultValue: 0,
            allowNull: true
        },
        h24: {
            type: DataTypes.DECIMAL(4,1),
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
        tableName: 'interaccion_hora',  
        timestamps: false
    });
    return ReporteHoras;
};