module.exports = (sequelize, DataTypes) => {
    const TasksAds = sequelize.define('tasks_ads', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        card_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        date_start: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        date_end: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        cities: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        ages: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        investment: {
            type: DataTypes.FLOAT,
            allowNull: true,
        },
        sexes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        target: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        segmentation: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        material_links: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        platform_links: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        cta_ad: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        seg_cities: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
        },
        seg_ages: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
        },
        seg_sexes: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
        },
        seg_segmentations: {
            type: DataTypes.ARRAY(DataTypes.STRING),
            allowNull: true,
        },
        seg_flag: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: true,
        },
    }, {
        tableName: 'tasks_ads',
        timestamps: false,
    });

    TasksAds.associate = function(models) {
        TasksAds.belongsTo(models.tasks_cards, {
            foreignKey: 'card_id',
            as: 'card',
        });
    };

    return TasksAds;
}