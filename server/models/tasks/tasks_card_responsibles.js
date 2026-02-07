module.exports = (sequelize, DataTypes) => {
    const TasksCardResponsibles = sequelize.define('tasks_card_responsibles', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        card_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        responsible_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
    }, {
        tableName: 'tasks_card_responsibles',
        timestamps: false,
    });

    TasksCardResponsibles.associate = (models) => {
        TasksCardResponsibles.belongsTo(models.tasks_cards, { foreignKey: 'card_id', onDelete: 'CASCADE' });
        TasksCardResponsibles.belongsTo(models.usuarios, { foreignKey: 'responsible_id', onDelete: 'CASCADE' });
    };

    return TasksCardResponsibles;
}