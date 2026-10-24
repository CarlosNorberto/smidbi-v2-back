module.exports = (sequelize, DataTypes) => {
    // Rubro o sector económico de un prospecto (hotelería, gastronomía, bienes raíces…).
    const Industries = sequelize.define('industries', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(120),
            allowNull: false,
        },
        active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    }, {
        tableName: 'industries',
        schema: 'lead_manager',
        timestamps: false,
    });
    return Industries;
}
