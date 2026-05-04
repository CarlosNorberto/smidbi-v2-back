module.exports = (sequelize, DataTypes) => {
    const ApplicationStatus = sequelize.define('application_status', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        application_status_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        bgcolor: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '#fff'
        },
        color: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '#000'
        },
    }, {
        tableName: 'application_status',
        schema: 'contract_manager',
        timestamps: false,
    });

    return ApplicationStatus;

};