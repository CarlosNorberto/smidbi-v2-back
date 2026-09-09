module.exports = (sequelize, DataTypes) => {
    const ViewAds = sequelize.define(
        'view_ads',
        {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            id_reporte: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            imagen: {
                type: DataTypes.STRING(200),
                allowNull: true,
            },
            usuario_creacion: {
                type: DataTypes.INTEGER,
                allowNull: false,
            },
            fecha_creacion: {
                type: DataTypes.DATE,
                defaultValue: DataTypes.NOW,
                allowNull: false,
            },
            usuario_modificacion: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            fecha_modificacion: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            usuario_eliminacion: {
                type: DataTypes.INTEGER,
                allowNull: true,
            },
            fecha_eliminacion: {
                type: DataTypes.DATE,
                allowNull: true,
            },
            activo: {
                type: DataTypes.BOOLEAN,
                defaultValue: true,
                allowNull: false,
            },
            orden: {
                type: DataTypes.INTEGER,
                defaultValue: 0,
                allowNull: true,
            },
            link_end_point: {
                type: DataTypes.TEXT,
                allowNull: true,
            },
            title: {
                type: DataTypes.STRING(300),
                allowNull: true,
            },
            image_url: {
                type: DataTypes.STRING,
                allowNull: true,
            },
            imagen_url_completa: {
                type: DataTypes.VIRTUAL,
                get() {
                    if (this.imagen) {
                        return `${process.env.BASE_URL}/uploads/ads/${this.imagen}`;
                    }
                    if (this.image_url) {
                        return `https://res.cloudinary.com/${process.env.CLOUDINARY_CLOUD_NAME}/image/upload/${this.image_url}`;
                    }
                    return null;
                },
            },
        },
        {
            timestamps: false,
            tableName: 'view_ads',
        },
    );

    return ViewAds;
};
