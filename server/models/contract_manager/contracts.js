module.exports = (sequelize, DataTypes) => {
    const Contracts = sequelize.define('contracts', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        application_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        applicant_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        client_support_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        responsible_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        application_status_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        final_state_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        write_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        create_date: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
        },
        company_form_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        start_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        end_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        observations: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
    }, {
        tableName: 'contracts',
        schema: 'contract_manager',
        timestamps: false,
    });

    Contracts.associate = (models) => {
        Contracts.belongsTo(models.company_form, { foreignKey: 'company_form_id', onDelete: 'CASCADE', as: 'company_form' });
        Contracts.belongsTo(models.usuarios, { foreignKey: 'applicant_id', as: 'applicant' });
        Contracts.belongsTo(models.usuarios, { foreignKey: 'client_support_id', as: 'client_support' });
        Contracts.belongsTo(models.usuarios, { foreignKey: 'responsible_id', as: 'responsible' });
        Contracts.belongsTo(models.application_status, { foreignKey: 'application_status_id', as: 'application_status' });
        Contracts.hasMany(models.signed_contracts, { foreignKey: 'contract_id', as: 'signed_contracts' });

        // SCOPE
        Contracts.addScope('withCompanyForm', {
            include: [
                {
                    model: models.company_form,
                    as: 'company_form',                    
                    attributes: ['id', 'company_name'],
                }
            ]
        });

        Contracts.addScope('withApplicants', {
            include: [
                {
                    model: models.usuarios,
                    as: 'applicant',                    
                    attributes: ['id', 'nombre'],
                }
            ]
        });

        Contracts.addScope('withClientSupport', {
            include: [
                {
                    model: models.usuarios,
                    as: 'client_support',                    
                    attributes: ['id', 'nombre'],
                }
            ]
        });

        Contracts.addScope('withResponsibles', {
            include: [
                {
                    model: models.usuarios,
                    as: 'responsible',                    
                    attributes: ['id', 'nombre'],
                }
            ]
        });

        Contracts.addScope('withApplicationStatus', {
            include: [
                {
                    model: models.application_status,
                    as: 'application_status',                    
                    attributes: ['id', 'application_status_name', 'bgcolor'],
                }
            ]
        });

        Contracts.addScope('withSignedContracts', {
            include: [
                {
                    model: models.signed_contracts,
                    as: 'signed_contracts',
                    attributes: ['id', 'url', 'public_id'],
                }
            ]
        });
    };

    return Contracts;
};