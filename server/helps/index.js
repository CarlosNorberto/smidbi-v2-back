const fs = require('fs');
const md = require('../models');

const getUploadUrl = (req, folder, filename) => {
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    return `${baseUrl}/uploads/${folder}/${filename}`;
};

const getUploadPath = (folder, filename) => {
    return `uploads/${folder}/${filename}`;
}

const convertImageToBase64 = async (imagePath) => {
    const base64 = fs.readFileSync(imagePath, { encoding: 'base64' });
    return `data:image/png;base64,${base64}`;
}

const getObjetivoLogrado = async (idReporte, idObjetivo) => {
    const objetivoLogrado = await md.reporte_dia.sum('valor', {
        where: {
            id_reporte: idReporte,
            id_objetivo: idObjetivo
        }
    }) ?? 0;
    return objetivoLogrado;
}

module.exports = {
    getUploadUrl,
    getUploadPath,
    convertImageToBase64,
    getObjetivoLogrado,
};