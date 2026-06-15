const fs = require('fs');
const md = require('../models');
const { format, parseISO } = require('date-fns');

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

/**
 * Genera el código de contrato
 * @param {Date} applicationDate - Fecha de aplicación
 * @param {number} contractId - ID del contrato
 * @returns {string} Código de contrato
 */
const generateContractCode = (applicationDate, contractId) => {
    const applicationYear = applicationDate
        ? applicationDate.split('-')[0]
        : null;

    return `ADM-CTR-${applicationYear}-${contractId}`;
};

/**
 * Convierte una cadena de fecha a un objeto Date
 * @param {string} dateString - Cadena de fecha
 * @returns {Date} Fecha
 */
const parseToDate = (dateString) => {
    if (!dateString) return null;
    
    // ambos formatos los maneja parseISO
    // '2026-06-24' → '2026-06-24'
    // '2026-02-01T04:00:00.000Z' → '2026-02-01'
    return format(parseISO(dateString), 'yyyy-MM-dd');
};

module.exports = {
    getUploadUrl,
    getUploadPath,
    convertImageToBase64,
    getObjetivoLogrado,
    getExpirationStatus,
    generateContractCode,
    parseToDate
};