module.exports = (sequelize, DataTypes) => {
    const CustomerTemperature = sequelize.define('customer_temperature', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        tableName: 'customer_temperature',
        schema: 'lead_manager',
        timestamps: false,
    });
    return CustomerTemperature;
};