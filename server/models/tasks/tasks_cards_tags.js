module.exports = (sequelize, DataTypes) => {
    const TasksCardsTags = sequelize.define('tasks_cards_tags', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        card_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        tag_id: {
            type: DataTypes.INTEGER,
            allowNull: false,        },
    }, {
        tableName: 'tasks_cards_tags',
        timestamps: false,
    });

    TasksCardsTags.associate = (models) => {
        TasksCardsTags.belongsTo(models.tasks_cards, { foreignKey: 'card_id', onDelete: 'CASCADE' });
        TasksCardsTags.belongsTo(models.tasks_tags, { foreignKey: 'tag_id', onDelete: 'CASCADE' });
    };

    return TasksCardsTags;
}