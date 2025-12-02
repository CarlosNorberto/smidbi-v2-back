module.exports = (sequelize, DataTypes) => {
    const Services = sequelize.define('services', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        service: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        bgcolor: {
            type: DataTypes.STRING,
            defaultValue: '#fff',
            allowNull: true,
        },
        color: {
            type: DataTypes.STRING,
            defaultValue: '#000',
            allowNull: true,
        },
    }, {
        tableName: 'services',
        schema: 'lead_manager',
        timestamps: false,
    });
    return Services;
}