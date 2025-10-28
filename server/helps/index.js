const fs = require('fs');

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

module.exports = {
    getUploadUrl,
    getUploadPath,
    convertImageToBase64,
};