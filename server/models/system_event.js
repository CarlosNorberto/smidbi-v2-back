'use strict';
module.exports = (sequelize, DataTypes) => {
    const SystemEvent = sequelize.define('system_events', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        level: { type: DataTypes.STRING(10), allowNull: false, defaultValue: 'error' },
        category: { type: DataTypes.STRING(30), allowNull: false },
        source: { type: DataTypes.STRING(120), allowNull: true },
        message: { type: DataTypes.TEXT, allowNull: false },
        detail: { type: DataTypes.JSONB, allowNull: true },
        user_id: { type: DataTypes.INTEGER, allowNull: true },
        user_name: { type: DataTypes.STRING(150), allowNull: true },
        method: { type: DataTypes.STRING(10), allowNull: true },
        path: { type: DataTypes.STRING(300), allowNull: true },
        status_code: { type: DataTypes.INTEGER, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, {
        schema: 'public',
        tableName: 'system_events',
        timestamps: false,
    });
    return SystemEvent;
};
