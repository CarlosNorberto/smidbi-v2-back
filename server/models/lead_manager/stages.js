// CREATE TABLE lead_manager.stages (
// 	id serial4 NOT NULL,
// 	"name" varchar NOT NULL,
// 	sort_order int4 DEFAULT 0 NOT NULL,
// 	kind varchar DEFAULT 'open'::character varying NOT NULL,
// 	color varchar DEFAULT '#e5e7eb'::character varying NULL,
// 	is_active bool DEFAULT true NOT NULL,
// 	CONSTRAINT stages_pkey PRIMARY KEY (id)
// );
module.exports = (sequelize, DataTypes) => {
    const Stages = sequelize.define('stages', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false
        },
        sort_order: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        kind: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: 'open',            
        },
        color: {
            type: DataTypes.STRING,
            allowNull: true,
            defaultValue: '#e5e7eb',
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    }, {
        tableName: 'stages',
        schema: 'lead_manager',
        timestamps: false,
    });
    return Stages;
}