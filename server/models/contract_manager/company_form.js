module.exports = (sequelize, DataTypes) => {
    const CompanyForm = sequelize.define('company_form', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        company_name: { type: DataTypes.STRING, allowNull: true },
        representative_name: { type: DataTypes.STRING, allowNull: true },
        email: { type: DataTypes.STRING, allowNull: true },
        phone: { type: DataTypes.STRING, allowNull: true },
        country_code_phone: { type: DataTypes.STRING, allowNull: true, defaultValue: '+591' },
        razon_social: { type: DataTypes.STRING, allowNull: true },

        // Packs / Pauta
        packs_pauta: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        payment_type_packs_pauta: { type: DataTypes.STRING, allowNull: true },
        detail_packs_pauta: { type: DataTypes.TEXT, allowNull: true },
        duration_packs_pauta: { type: DataTypes.STRING, allowNull: true },
        scope_of_service_packs_pauta: { type: DataTypes.TEXT, allowNull: true },
        start_date_packs_pauta: { type: DataTypes.STRING, allowNull: true },
        end_date_packs_pauta: { type: DataTypes.STRING, allowNull: true },

        // Traffickers
        traffickers: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        payment_type_traffickers: { type: DataTypes.STRING, allowNull: true },
        detail_traffickers: { type: DataTypes.TEXT, allowNull: true },
        duration_traffickers: { type: DataTypes.STRING, allowNull: true },
        scope_of_service_traffickers: { type: DataTypes.TEXT, allowNull: true },
        start_date_traffickers: { type: DataTypes.STRING, allowNull: true },
        end_date_traffickers: { type: DataTypes.STRING, allowNull: true },

        // Consulting
        consulting: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        custom_consulting: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        payment_type_consulting: { type: DataTypes.STRING, allowNull: true },
        detail_consulting: { type: DataTypes.TEXT, allowNull: true },
        duration_consulting: { type: DataTypes.STRING, allowNull: true },
        scope_of_service_consulting: { type: DataTypes.TEXT, allowNull: true },
        start_date_consulting: { type: DataTypes.STRING, allowNull: true },
        end_date_consulting: { type: DataTypes.STRING, allowNull: true },

        // Analítica
        analitica: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        payment_type_analitica: { type: DataTypes.STRING, allowNull: true },
        detail_analitica: { type: DataTypes.TEXT, allowNull: true },
        duration_analitica: { type: DataTypes.STRING, allowNull: true },
        scope_of_service_analitica: { type: DataTypes.TEXT, allowNull: true },
        start_date_analitica: { type: DataTypes.STRING, allowNull: true },
        end_date_analitica: { type: DataTypes.STRING, allowNull: true },

        // SEO
        seo: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        payment_type_seo: { type: DataTypes.STRING, allowNull: true },
        detail_seo: { type: DataTypes.TEXT, allowNull: true },
        duration_seo: { type: DataTypes.STRING, allowNull: true },
        scope_of_service_seo: { type: DataTypes.TEXT, allowNull: true },
        start_date_seo: { type: DataTypes.STRING, allowNull: true },
        end_date_seo: { type: DataTypes.STRING, allowNull: true },

        // Flags de tipo de fee/servicio
        fee_mensual: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        fee_variable: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        fee_mixto: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        cantidad_horas: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        proyecto_completo: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        fee_seo_tecnico: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        fee_seo_contenido: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        cantidad_contenidos: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        fee_linkbuilding: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        fee_proyecto: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        pago_mensual: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },

        // Addendum
        addendum: { type: DataTypes.BOOLEAN, allowNull: true, defaultValue: false },
        title_addendum: { type: DataTypes.STRING, allowNull: true },
        number_addendum: { type: DataTypes.STRING, allowNull: true },
        scope_of_service_addendum: { type: DataTypes.TEXT, allowNull: true },
        date_addendum: { type: DataTypes.STRING, allowNull: true },
        previous_contract_date_addendum: { type: DataTypes.STRING, allowNull: true },
        object_addendum: { type: DataTypes.TEXT, allowNull: true },
        contract_validity_addendum: { type: DataTypes.STRING, allowNull: true },
        legal_representative_addendum: { type: DataTypes.STRING, allowNull: true },
    }, {
        tableName: 'company_form',
        schema: 'contract_manager',
        timestamps: false,
    });

    CompanyForm.associate = (models) => {
        CompanyForm.hasMany(models.contracts, { foreignKey: 'company_form_id', as: 'contracts' });
    };

    return CompanyForm;
};