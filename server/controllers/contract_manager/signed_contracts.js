const md = require('../../models');
const cloudinary = require('cloudinary').v2;
const path = require('path');

const getSignedContracts = async (req, res) => {
    try {
        const { contractId } = req.params;

        const signedContracts = await md.signed_contracts.findAll({
            where: { contract_id: contractId },
            order: [['create_date', 'DESC']],
        });

        return res.status(200).json(signedContracts);

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
}