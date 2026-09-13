'use strict';
module.exports = (sequelize, DataTypes) => {
    const QualifyImage = sequelize.define('qualify_image', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true
        },
        id_brief: DataTypes.INTEGER,
        image: DataTypes.STRING,
        fecha_creacion: DataTypes.DATE,
        usuario_creacion: DataTypes.INTEGER,
        fecha_modificacion: DataTypes.DATE,
        usuario_modificacion: DataTypes.INTEGER,
        fecha_eliminacion: DataTypes.DATE,
        usuario_eliminacion: DataTypes.INTEGER,
        descripcion: DataTypes.STRING,
        // Carpeta compartida con el backend antiguo (igual que view_ads): las
        // imágenes viven en disco, no hay columna separada para Cloudinary acá.
        imagen_url_completa: {
            type: DataTypes.VIRTUAL,
            get() {
                if (!this.image) return null;
                return `${process.env.BASE_URL}/uploads/qualify_images/${this.image}`;
            },
        },
    }, {
        schema: 'public',
        timestamps: false,
        tableName: 'qualify_image'
    });
    return QualifyImage;
};
