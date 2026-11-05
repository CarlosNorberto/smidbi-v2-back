const md = require('../models');
const cloudinary = require('cloudinary').v2;
const { logEvent } = require('./systemEventService');

/**
 * Elimina un contrato COMPLETO del Gestor de Contratos: sus contratos firmados (filas y archivos de Cloudinary),
 * el contrato y el formulario de la empresa (company_form) del que nació.
 *
 * - La base solo relaciona contracts -> company_form (ON DELETE CASCADE). `signed_contracts` NO tiene relación con
 *   contracts, así que sin esto sus filas y sus archivos quedaban huérfanos al borrar un contrato.
 * - Todo lo de la base va en UNA transacción: o se borra todo o nada.
 * - Los archivos de Cloudinary se borran DESPUÉS de confirmar la transacción: si Cloudinary falla, el contrato ya
 *   no existe y el fallo queda en el registro de errores (no se puede deshacer el borrado ni vale la pena trabar
 *   al usuario por un archivo suelto).
 *
 * @returns {Promise<null | { contractId: number, companyFormId: number|null, files: number, filesFailed: number }>}
 *          null si el contrato no existe.
 */
const deleteContract = async (contractId) => {
    const contract = await md.contracts.findByPk(contractId, { attributes: ['id', 'company_form_id'] });
    if (!contract) return null;

    const signed = await md.signed_contracts.findAll({
        where: { contract_id: contract.id },
        attributes: ['id', 'public_id'],
        raw: true,
    });

    let companyFormDeleted = false;
    await md.sequelize.transaction(async (transaction) => {
        await md.signed_contracts.destroy({ where: { contract_id: contract.id }, transaction });
        await md.contracts.destroy({ where: { id: contract.id }, transaction });
        if (contract.company_form_id) {
            // El formulario pertenece a un solo contrato; solo se conserva si, por datos anteriores, otro lo usa.
            const stillUsed = await md.contracts.count({ where: { company_form_id: contract.company_form_id }, transaction });
            if (stillUsed === 0) {
                await md.company_form.destroy({ where: { id: contract.company_form_id }, transaction });
                companyFormDeleted = true;
            }
        }
    });

    const failed = [];
    for (const file of signed) {
        if (!file.public_id) continue;
        try {
            await cloudinary.uploader.destroy(file.public_id, { resource_type: 'raw' });
        } catch (error) {
            failed.push({ public_id: file.public_id, error: error.message });
        }
    }
    if (failed.length > 0) {
        logEvent({
            level: 'warning',
            category: 'servidor',
            source: 'contract_manager',
            message: `Se eliminó el contrato ${contract.id}, pero no se pudieron borrar ${failed.length} archivo(s) firmados de Cloudinary`,
            detail: { contractId: contract.id, files: failed },
        });
    }

    return {
        contractId: contract.id,
        companyFormId: companyFormDeleted ? contract.company_form_id : null,
        files: signed.length,
        filesFailed: failed.length,
    };
};

module.exports = { deleteContract };
