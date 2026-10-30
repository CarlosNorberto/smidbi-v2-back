'use strict';
module.exports = (sequelize, DataTypes) => {
    const Notification = sequelize.define('notifications', {
        id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
        user_id: { type: DataTypes.INTEGER, allowNull: false },
        type: { type: DataTypes.STRING(60), allowNull: false },
        title: { type: DataTypes.STRING(200), allowNull: false },
        body: { type: DataTypes.TEXT, allowNull: true },
        link: { type: DataTypes.STRING(300), allowNull: true },
        read_at: { type: DataTypes.DATE, allowNull: true },
        created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
    }, {
        schema: 'public',
        tableName: 'notifications',
        timestamps: false,
    });
    return Notification;
};
