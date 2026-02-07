module.exports = (sequelize, DataTypes) => {
    const TasksTags = sequelize.define('tasks_tags', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        color: {
            type: DataTypes.STRING(10),
            allowNull: true,
        },
    }, {
        tableName: 'tasks_tags',
        timestamps: false,
    });
    return TasksTags;
}