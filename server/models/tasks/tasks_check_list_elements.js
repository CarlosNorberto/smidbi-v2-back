module.exports = (sequelize, DataTypes) => {
    const TasksCheckListElements = sequelize.define('tasks_check_list_elements', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(300),
            allowNull: false,
        },
        check_list_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        order: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        completed: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true,
        },
    }, {
        tableName: 'tasks_check_list_elements',
        timestamps: false,
    });

    TasksCheckListElements.associate = function(models) {
        TasksCheckListElements.belongsTo(models.tasks_check_lists, {
            foreignKey: 'check_list_id',
            as: 'check_list',
        });
    };

    return TasksCheckListElements;
}