module.exports = (sequelize, DataTypes) => {
    const Status = sequelize.define('status', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        state: {
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
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        tableName: 'status',
        schema: 'lead_manager',
        timestamps: false,
    });
    return Status;
}