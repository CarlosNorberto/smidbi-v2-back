module.exports = (sequelize, DataTypes) => {
    const SignedContracts = sequelize.define('signed_contracts', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        contract_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        filename: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        originalname: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        type: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        create_date: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
        },
        url: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        public_id: {
            type: DataTypes.STRING,
            allowNull: true,
        },
    }, {
        tableName: 'signed_contracts',
        schema: 'contract_manager',
        timestamps: false,
    });

    SignedContracts.associate = (models) => {
        SignedContracts.belongsTo(models.contracts, { foreignKey: 'contract_id', onDelete: 'CASCADE', as:'contract' });
    };

    return SignedContracts;
};