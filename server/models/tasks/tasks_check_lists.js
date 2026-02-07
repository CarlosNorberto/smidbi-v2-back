module.exports = (sequelize, DataTypes) => {
    const TasksCheckLists = sequelize.define('tasks_check_lists', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        order: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
    }, {
        tableName: 'tasks_check_lists',
        timestamps: false,
    });
    return TasksCheckLists;
}