module.exports = (sequelize, DataTypes) => {
    const ProspectHistory = sequelize.define('prospect_history', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        prospect_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        responsible_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        status_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        date: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        observations: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        meeting_status_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        situation: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        last_contact: {
            type: DataTypes.DATEONLY,
            allowNull: true,
        },
        final_state_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
        order: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: true,
        },
        write_date: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        create_date: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
            allowNull: true,
        },
        partner: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        fuente_medio: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        stage_id: {
            type: DataTypes.INTEGER,
            allowNull: true,
        },
    }, {
        tableName: 'prospect_history',
        schema: 'lead_manager',
        timestamps: false,
    });

    ProspectHistory.associate = (models) => {
        ProspectHistory.belongsTo(models.stages, { foreignKey: 'stage_id', onDelete: 'CASCADE', as:'stage' });
        ProspectHistory.belongsTo(models.prospects, { foreignKey: 'prospect_id', onDelete: 'CASCADE', as:'prospect' });
        ProspectHistory.belongsTo(models.usuarios, { foreignKey: 'responsible_id', onDelete: 'SET NULL', as:'responsible' });
        ProspectHistory.belongsTo(models.status, { foreignKey: 'status_id', onDelete: 'SET NULL', as:'status' });
        ProspectHistory.belongsTo(models.status, { foreignKey: 'meeting_status_id', onDelete: 'SET NULL', as:'meeting_status' });
        ProspectHistory.belongsTo(models.status, { foreignKey: 'final_state_id', onDelete: 'SET NULL', as:'final_state' });
        ProspectHistory.belongsToMany(models.services, {
            through: 'prospect_history_services',
            foreignKey: 'prospect_history_id',
            otherKey: 'service_id',
            as: 'services',
            onDelete: 'CASCADE',
        });
        ProspectHistory.belongsTo(models.customer_temperature, { foreignKey: 'customer_temperature_id', onDelete: 'SET NULL', as:'temperature' });
    };

    return ProspectHistory;
}