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
    }, {
        tableName: 'prospect_history',
        schema: 'lead_manager',
        timestamps: false,
    });
    return ProspectHistory;
}