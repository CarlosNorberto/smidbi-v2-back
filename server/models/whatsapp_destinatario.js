'use strict';
module.exports = (sequelize, DataTypes) => {
    const WhatsappDestinatario = sequelize.define('whatsapp_destinatarios', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        nombre: { type: DataTypes.STRING(120), allowNull: false },
        telefono: { type: DataTypes.STRING(15), allowNull: false, unique: true },
        procesos: { type: DataTypes.ARRAY(DataTypes.STRING), allowNull: false, defaultValue: [] },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    }, {
        schema: 'public',
        tableName: 'whatsapp_destinatarios',
        timestamps: true,
        underscored: true,
    });
    return WhatsappDestinatario;
};
