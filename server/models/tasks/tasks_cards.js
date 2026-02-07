module.exports = (sequelize, DataTypes) => {
    const TasksCards = sequelize.define('tasks_cards', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(200),
            allowNull: true,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        report_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        order: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        list_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        exp_date_day: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        exp_date_month: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        exp_date_year: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        exp_time_hour: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        exp_time_minute: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        completed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true,
        },
        archived: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true,
        },
        sent_reminder: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true,
        },
        reminder_time: {
            type: DataTypes.INTEGER,
            defaultValue: -1,
            allowNull: true,
        },
        date_completed: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        tableName: 'tasks_cards',
        timestamps: false,
    });

    TasksCards.associate = function(models) {
        TasksCards.belongsTo(models.tasks_lists, {
            foreignKey: 'list_id',
            as: 'list',
        });
        TasksCards.belongsTo(models.reportes, {
            foreignKey: 'report_id',
            as: 'report',
        });
    };

    return TasksCards;
}