module.exports = (sequelize, DataTypes) => {
    const TasksActivities = sequelize.define('tasks_activities', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        card_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        activity_detail: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        date_activity: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        responsible_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: 'tasks_activities',
        timestamps: false,
    });

    TasksActivities.associate = (models) => {
        TasksActivities.belongsTo(models.tasks_cards, { foreignKey: 'card_id', onDelete: 'CASCADE' });
        TasksActivities.belongsTo(models.usuarios, { foreignKey: 'responsible_id', onDelete: 'CASCADE' });
    };

    return TasksActivities;
}