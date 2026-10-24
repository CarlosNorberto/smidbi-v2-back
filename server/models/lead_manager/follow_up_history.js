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
        // Auditoría de las gestiones nuevas (las del sistema anterior quedan en NULL).
        created_by: {
            type: DataTypes.STRING(200),
            allowNull: true,
        },
        updated_by: {
            type: DataTypes.STRING(200),
            allowNull: true,
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, {
        tableName: 'follow_up_history',
        schema: 'lead_manager',
        timestamps: false,
    });
    return FollowUpHistory;
}