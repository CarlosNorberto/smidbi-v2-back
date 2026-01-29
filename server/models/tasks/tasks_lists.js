module.exports = (sequelize, DataTypes) => {
    const TasksLists = sequelize.define('tasks_lists', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        title: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        order: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
    }, {
        tableName: 'tasks_lists',
        timestamps: false,
    });
    return TasksLists;
}