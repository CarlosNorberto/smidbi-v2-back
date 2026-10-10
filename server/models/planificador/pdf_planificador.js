'use strict';
module.exports = (sequelize, DataTypes) => {
    const PdfPlanificador = sequelize.define('pdf_planificador', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        id_brief: { type: DataTypes.INTEGER, allowNull: false },
        usuario_creacion: { type: DataTypes.INTEGER, allowNull: false },
        pdf: { type: DataTypes.STRING, allowNull: false },
        fecha_creacion: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
        // El cliente ve el PDF y acepta/rechaza la propuesta en una vista pública sin
        // login (/propuesta/:token) — respuesta guarda esa decisión (null=pendiente).
        respuesta: { type: DataTypes.BOOLEAN, allowNull: true },
        activo: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
        // Token de acceso público (columna propia, no compartida con la app antigua —
        // esa usaba el nombre del archivo del PDF como identificador en la URL, algo
        // adivinable ya que es solo un timestamp). allowNull porque filas viejas/de la
        // app antigua no lo tienen.
        token: { type: DataTypes.STRING(64), allowNull: true, unique: true },
        // Tipos incluidos en el PDF ('CPC_CPV,CPM', ordenados). null en filas de la app antigua.
        tipos: { type: DataTypes.STRING(50), allowNull: true },
    }, {
        schema: 'public',
        timestamps: false,
        tableName: 'pdf_planificador',
    });

    PdfPlanificador.associate = (models) => {
        PdfPlanificador.belongsTo(models.request_brief, { foreignKey: 'id_brief', as: 'request_brief' });
    };

    return PdfPlanificador;
};
