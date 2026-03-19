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

const getExpirationStatus = (card) => {
    // 'expired' | 'active' | 'expiring_soon'
    if (card.exp_date_year && card.exp_date_month && card.exp_date_day) {
        const expDate = new Date(card.exp_date_year, card.exp_date_month - 1, card.exp_date_day, card.exp_time_hour, card.exp_time_minute);
        const currentDate = new Date();
        const timeDiff = expDate - currentDate;
        const daysDiff = timeDiff / (1000 * 60 * 60 * 24);
        if (timeDiff < 0) {
            return 'expired';
        } else if (daysDiff <= 1) {
            return 'expiring_soon';
        } else {
            return 'active';
        }        
    }
    return '';
};

module.exports = {
    getUploadUrl,
    getUploadPath,
    convertImageToBase64,
    getObjetivoLogrado,
    getExpirationStatus,
};