module.exports = (sequelize, DataTypes) => {
    const Prospects = sequelize.define('prospects', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        country: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        city: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        name: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        position: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        email: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        phone: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        web_page: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        client: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        tableName: 'prospects',
        schema: 'lead_manager',
        timestamps: false,
    });
    return Prospects;
}