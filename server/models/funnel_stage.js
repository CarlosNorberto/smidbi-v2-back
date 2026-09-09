module.exports = (sequelize, DataTypes) => {
    const FunnelStage = sequelize.define(
        'funnel_stage',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            id_reporte: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            punto1: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            punto2: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            punto3: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            punto4: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: false,
            },
            activo: {
                type: DataTypes.BOOLEAN,
                defaultValue: false,
                allowNull: true,
            },
        },
        {
            timestamps: false,
            tableName: 'funnel_stage',
        },
    );
    return FunnelStage;
};
