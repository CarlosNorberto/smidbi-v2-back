module.exports = (sequelize, DataTypes) => {
    const TasksCardChecklist = sequelize.define('tasks_card_checklist', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        card_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        check_list_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: 'tasks_card_checklist',
        timestamps: false,
    });

    TasksCardChecklist.associate = (models) => {
        TasksCardChecklist.belongsTo(models.tasks_cards, { foreignKey: 'card_id', onDelete: 'CASCADE' });
        TasksCardChecklist.belongsTo(models.tasks_check_lists, { foreignKey: 'check_list_id', onDelete: 'CASCADE' });
    };

    return TasksCardChecklist;
}