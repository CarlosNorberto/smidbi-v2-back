module.exports = (sequelize, DataTypes) => {
    const ProspectHistoryServices = sequelize.define('prospect_history_services', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        prospect_history_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        service_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: 'prospect_history_services',
        schema: 'lead_manager',
        timestamps: false,
    });
    return ProspectHistoryServices;
}