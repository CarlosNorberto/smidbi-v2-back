const md = require('../models');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');

// ************** CALIFICACIÓN (q1-q4 + resultado, o RATE CARD)

const getByBriefId = async (req, res) => {
    try {
        const { id_brief } = req.params;
        const qualifyBrief = await md.qualify_brief.findOne({ where: { id_brief } });
        res.status(200).json(qualifyBrief);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener la calificación: ${error.message}` });
    }
};

const saveUpdate = async (req, res) => {
    try {
        const body = req.body;
        if (!body.id_brief || !body.qualify) {
            return res.status(400).json({ message: 'id_brief y qualify son obligatorios.' });
        }

        let qualifyBrief = await md.qualify_brief.findOne({ where: { id_brief: body.id_brief } });

        const data = {
            id_brief: body.id_brief,
            q1: body.q1 ?? null,
            q2: body.q2 ?? null,
            q3: body.q3 ?? null,
            q4: body.q4 ?? null,
            qualify: body.qualify,
        };

        if (qualifyBrief) {
            data.usuario_modificacion = req.user.id;
            data.fecha_modificacion = new Date();
            await qualifyBrief.update(data);
        } else {
            data.usuario_creacion = req.user.id;
            qualifyBrief = await md.qualify_brief.create(data);
        }

        // Al calificar un brief se lo marca como revisado (equivalente a lo
        // que la app antigua hacía al abrir la pantalla de calificación).
        await md.request_brief.update(
            { reviewed: true, usuario_modificacion: req.user.id, fecha_modificacion: new Date() },
            { where: { id: body.id_brief } }
        );

        res.status(200).json({ message: 'Calificación guardada correctamente', data: qualifyBrief });
    } catch (error) {
        res.status(500).json({ message: `Error al guardar la calificación: ${error.message}` });
    }
};

// ************** IMÁGENES DE RESPALDO

const MIME_TO_EXT = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
};

const QUALIFY_IMAGE_MAX_WIDTH = 1600;
const QUALIFY_IMAGE_QUALITY = 80;

// Redimensiona/comprime la imagen de respaldo antes de guardarla (mismo
// criterio que las imágenes de anuncios de reportes).
const resizeQualifyImage = async (buffer, mimetype) => {
    let pipeline = sharp(buffer, { animated: mimetype === 'image/gif' }).resize({
        width: QUALIFY_IMAGE_MAX_WIDTH,
        withoutEnlargement: true,
    });

    if (mimetype === 'image/jpeg') {
        pipeline = pipeline.jpeg({ quality: QUALIFY_IMAGE_QUALITY });
    } else if (mimetype === 'image/png') {
        pipeline = pipeline.png({ quality: QUALIFY_IMAGE_QUALITY });
    } else if (mimetype === 'image/webp') {
        pipeline = pipeline.webp({ quality: QUALIFY_IMAGE_QUALITY });
    }

    return pipeline.toBuffer();
};

const getImagesByBriefId = async (req, res) => {
    try {
        const { id_brief } = req.params;
        const images = await md.qualify_image.findAll({
            where: { id_brief },
            order: [['id', 'ASC']],
        });
        res.status(200).json(images);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las imágenes: ${error.message}` });
    }
};

const uploadImage = async (req, res) => {
    try {
        const { id_brief } = req.params;
        const file = req.file;

        if (!file) {
            return res.status(400).json({ message: 'No se ha subido ninguna imagen.' });
        }
        if (!MIME_TO_EXT[file.mimetype]) {
            return res.status(400).json({ message: 'La extensión del archivo no es válida.' });
        }
        if (!process.env.LEGACY_QUALIFY_IMAGES_UPLOADS_PATH) {
            return res.status(500).json({ message: 'LEGACY_QUALIFY_IMAGES_UPLOADS_PATH no está configurado en el servidor.' });
        }

        const extension = path.extname(file.originalname) || MIME_TO_EXT[file.mimetype];
        const filename = `${crypto.randomUUID()}${extension}`;
        const destination = path.join(process.env.LEGACY_QUALIFY_IMAGES_UPLOADS_PATH, filename);

        const resizedBuffer = await resizeQualifyImage(file.buffer, file.mimetype);
        await fs.promises.writeFile(destination, resizedBuffer);

        const qualifyImage = await md.qualify_image.create({
            id_brief,
            image: filename,
            usuario_creacion: req.user.id,
        });

        res.status(200).json({ message: 'Imagen subida exitosamente.', data: qualifyImage });
    } catch (error) {
        res.status(500).json({ message: `Error al subir la imagen: ${error.message}` });
    }
};

const updateImageDescription = async (req, res) => {
    try {
        const { id } = req.params;
        const { descripcion } = req.body;
        const qualifyImage = await md.qualify_image.findByPk(id);
        if (!qualifyImage) {
            return res.status(404).json({ message: 'No se encontró la imagen' });
        }
        await qualifyImage.update({
            descripcion,
            usuario_modificacion: req.user.id,
            fecha_modificacion: new Date(),
        });
        res.status(200).json({ message: 'Descripción actualizada correctamente', data: qualifyImage });
    } catch (error) {
        res.status(500).json({ message: `Error al actualizar la descripción: ${error.message}` });
    }
};

const deleteImage = async (req, res) => {
    try {
        const { id } = req.params;
        const qualifyImage = await md.qualify_image.findByPk(id);
        if (!qualifyImage) {
            return res.status(404).json({ message: 'No se encontró la imagen' });
        }

        if (qualifyImage.image && process.env.LEGACY_QUALIFY_IMAGES_UPLOADS_PATH) {
            const filePath = path.join(process.env.LEGACY_QUALIFY_IMAGES_UPLOADS_PATH, qualifyImage.image);
            await fs.promises.unlink(filePath).catch(() => {
                // si el archivo ya no está en disco, igual se elimina el registro
            });
        }

        await qualifyImage.destroy();
        res.status(200).json({ message: 'Imagen eliminada exitosamente.' });
    } catch (error) {
        res.status(500).json({ message: `Error al eliminar la imagen: ${error.message}` });
    }
};

module.exports = {
    getByBriefId,
    saveUpdate,
    getImagesByBriefId,
    uploadImage,
    updateImageDescription,
    deleteImage,
};
