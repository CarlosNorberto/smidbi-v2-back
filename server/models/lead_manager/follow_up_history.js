module.exports = (sequelize, DataTypes) => {
    const FollowUpHistory = sequelize.define('follow_up_history', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        prospect_history_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        create_date: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: 'follow_up_history',
        schema: 'lead_manager',
        timestamps: false,
    });
    return FollowUpHistory;
}