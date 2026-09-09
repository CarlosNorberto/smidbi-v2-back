module.exports = (sequelize, DataTypes) => {
    const Responsibles = sequelize.define('responsibles', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        responsible: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }, {
        tableName: 'responsibles',
        schema: 'lead_manager',
        timestamps: false,
    });
    Responsibles.associate = (models) => {
        Responsibles.hasMany(models.prospect_history, {
            foreignKey: 'responsible_id',
            as: 'prospect_history',
        });
    };
    return Responsibles;
};