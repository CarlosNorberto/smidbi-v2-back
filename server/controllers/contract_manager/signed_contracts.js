const md = require('../../models');
const cloudinary = require('cloudinary').v2;
const path = require('path');
const fs = require('fs');

// Contratos firmados subidos con el SISTEMA ANTIGUO: ese guardaba el archivo en disco (server/uploads/signed_contracts) y dejaba
// `url`/`public_id` vacíos; solo guardó el nombre del archivo en `filename`. Para poder verlos desde aquí hay que apuntar
// LEGACY_SIGNED_CONTRACTS_PATH a esa carpeta (como las otras LEGACY_*). NO se monta como carpeta pública (son contratos): se
// entregan solo por downloadSignedContract, con sesión y rol del gestor de contratos. Los que se suben desde este sistema van a
// Cloudinary (con `url`) y nunca pasan por aquí.
// Carpetas donde buscar los archivos antiguos: una o varias separadas por ";" (el sistema antiguo y este están en el mismo servidor,
// pero cada uno corre con su propia ruta y, a veces, con otro usuario del sistema).
const legacyFolders = () => (process.env.LEGACY_SIGNED_CONTRACTS_PATH || '').split(';').map((p) => p.trim()).filter(Boolean);

// Revisa UNA carpeta: devuelve { file } si el archivo se puede leer o { reason } con la causa.
// (fs.existsSync daba "no existe" también cuando el problema era de PERMISOS sobre la carpeta de la otra app.)
const checkFolder = (folder, name) => {
    const full = path.join(folder, name);
    try {
        fs.accessSync(full, fs.constants.R_OK);
        return { file: full };
    } catch (error) {
        if (error.code === 'EACCES' || error.code === 'EPERM') return { reason: 'no_permission' };
        try {
            fs.accessSync(folder, fs.constants.R_OK | fs.constants.X_OK);
            return { reason: 'missing_file' };
        } catch (folderError) {
            return { reason: folderError.code === 'ENOENT' ? 'folder_not_found' : 'no_permission' };
        }
    }
};

// Busca el archivo antiguo (solo por su nombre: basename, nunca sale de la carpeta). Devuelve { file } o { reason, folders }.
// reason: 'not_configured' | 'folder_not_found' | 'no_permission' | 'missing_file' (el más "grave" de las carpetas revisadas).
const PRIORITY = ['no_permission', 'missing_file', 'folder_not_found'];
const findLegacyFile = (fileName) => {
    const folders = legacyFolders();
    if (folders.length === 0) return { reason: 'not_configured', folders };
    const name = fileName ? path.basename(String(fileName)) : '';
    if (!name) return { reason: 'missing_file', folders };
    const reasons = [];
    for (const folder of folders) {
        const result = checkFolder(folder, name);
        if (result.file) return { file: result.file };
        reasons.push(result.reason);
    }
    return { reason: PRIORITY.find((r) => reasons.includes(r)) || 'missing_file', folders };
};

// Mensaje (para mostrar tal cual) de por qué no se puede bajar un contrato antiguo.
const unavailableMessage = ({ reason, folders }, fileName) => {
    const where = folders.join(' ; ');
    switch (reason) {
        case 'not_configured':
            return 'Los contratos firmados del sistema antiguo no están configurados en el servidor (falta LEGACY_SIGNED_CONTRACTS_PATH).';
        case 'folder_not_found':
            return `La carpeta configurada (${where}) no existe en el servidor.`;
        case 'no_permission':
            return `El servidor no tiene permiso para leer ${where}. Revise los permisos de esa carpeta (o el usuario con el que corre esta app).`;
        default:
            return `El archivo ${fileName || '(sin nombre)'} no está en ${where}.`;
    }
};

const getSignedContracts = async (req, res) => {
    try {
        const { contractId } = req.params;

        const signedContracts = await md.signed_contracts.findAll({
            where: { contract_id: contractId },
            order: [['create_date', 'DESC']],
        });

        // `downloadable`: se puede bajar (está en Cloudinary, o es uno antiguo y su archivo se puede leer en la carpeta configurada).
        // Si no, `unavailable_reason` y `unavailable_message` dicen por qué (ver findLegacyFile).
        return res.status(200).json(signedContracts.map((item) => {
            if (item.url) return { ...item.toJSON(), downloadable: true, unavailable_reason: null, unavailable_message: null };
            const found = findLegacyFile(item.filename);
            return {
                ...item.toJSON(),
                downloadable: !!found.file,
                unavailable_reason: found.file ? null : found.reason,
                unavailable_message: found.file ? null : unavailableMessage(found, item.filename),
            };
        }));

    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

// Descarga de un contrato firmado ANTIGUO (el archivo está en el disco del sistema antiguo). Los de Cloudinary se bajan con su url.
const downloadSignedContract = async (req, res) => {
    try {
        const signedContract = await md.signed_contracts.findByPk(req.params.id);
        if (!signedContract) return res.status(404).json({ message: 'No se encuentra el contrato firmado con el ID especificado.' });
        if (signedContract.url) return res.redirect(signedContract.url);
        const found = findLegacyFile(signedContract.filename);
        if (!found.file) {
            // 404 y no 403: el interceptor del frontend manda al login ante un 403.
            console.warn(`[contratos firmados] contrato firmado ${signedContract.id} no disponible (${found.reason}): ${unavailableMessage(found, signedContract.filename)}`);
            return res.status(404).json({ message: unavailableMessage(found, signedContract.filename) });
        }
        const file = found.file;
        return res.download(path.resolve(file), signedContract.originalname || path.basename(file));
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
}

const uploadSignedContract = async (req, res) => {
    let uploadResult = null;
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No se envió ningún archivo' });
        }

        const { contractId } = req.params;
        // Sin esta revisión se subía el archivo a Cloudinary aunque el contrato no existiera.
        const contractExists = await md.contracts.count({ where: { id: contractId } });
        if (!contractExists) {
            return res.status(404).json({ message: 'No se encuentra el contrato con el ID especificado.' });
        }
        const extension = path.extname(req.file.originalname);

        const b64 = Buffer.from(req.file.buffer).toString('base64');
        const dataURI = `data:${req.file.mimetype};base64,${b64}`;
        // Se asigna a la variable de afuera (antes era un `const` nuevo que la ocultaba), para que el catch
        // pueda borrar el archivo si falla el guardado en la base.
        uploadResult = await cloudinary.uploader.upload(dataURI, { folder: 'SMID/SIGNED CONTRACTS', resource_type: 'raw', format: extension.replace('.', '') });

        const signedContract = await md.signed_contracts.create({
            contract_id: contractId,
            filename: uploadResult.public_id,
            originalname: req.file.originalname,
            type: req.file.mimetype,
            url: uploadResult.secure_url,
            public_id: uploadResult.public_id,
        });

        return res.status(200).json({
            message: 'Contrato subido correctamente',
            data: signedContract,
        });

    } catch (error) {
        if (uploadResult?.public_id) {
            await cloudinary.uploader.destroy(uploadResult.public_id, { resource_type: 'raw' });
        }
        return res.status(500).json({ message: error.message });
    }
}

const removeSignedContract = async (req, res) => {
    try {
        const { contractId } = req.params;
        const contract = await md.signed_contracts.findByPk(contractId);
        if (!contract) {
            return res.status(404).json({ message: "No se encuentra el contrato firmado con el ID especificado." });
        }
        if (contract.public_id) {
            await cloudinary.uploader.destroy(contract.public_id, { resource_type: 'raw' });
        }
        await contract.destroy();
        res.status(200).json({ message: "Contrato firmado eliminado con éxito" });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getSignedContracts,
    uploadSignedContract,
    removeSignedContract,
    downloadSignedContract,    
}