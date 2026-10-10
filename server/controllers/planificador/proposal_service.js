'use strict';
const fs = require('fs');
const path = require('path');
const md = require('../../models');

// Carpeta compartida con el backend antiguo — ver LEGACY_PDF_PLANIFICADOR_UPLOADS_PATH
// en .env (misma tabla `pdf_planificador`, misma carpeta física en ambos sistemas).
const UPLOADS_PATH = process.env.LEGACY_PDF_PLANIFICADOR_UPLOADS_PATH
    || path.join(__dirname, '..', '..', 'uploads', 'pdf_planificador');

// Regla de negocio: por brief existe UNA sola fila en pdf_planificador (igual que la
// app antigua): el PDF vigente de su cotización actual. Cualquier cambio en la
// cotización (o en lo que el PDF muestra del brief) borra esa fila y su archivo, y el
// siguiente "Generar PDF" crea una nueva. "Generar PDF" sin cambios solo devuelve el
// PDF ya generado. Si el cliente ya ACEPTÓ la propuesta, editar es excepcional: solo
// admin/superadmin y con confirmación explícita, porque se pierde el registro de lo
// que aceptó.

const isAdminUser = (user) => ['admin', 'superadmin'].includes(user?.role?.rol);

const findLatest = (id_brief, options = {}) => md.pdf_planificador.findOne({
    where: { id_brief },
    order: [['id', 'DESC']],
    ...options,
});

// Última fila (propuesta) de cada brief, para mostrar su estado en listados.
// Devuelve un Map id_brief -> { respuesta, activo, fecha_creacion, tipos }.
const getLatestByBriefIds = async (ids) => {
    const map = new Map();
    if (!ids.length) return map;
    const rows = await md.pdf_planificador.findAll({
        where: { id_brief: ids },
        attributes: ['id', 'id_brief', 'respuesta', 'activo', 'fecha_creacion', 'tipos'],
        order: [['id', 'ASC']],
    });
    // Orden ascendente: la última escritura por brief es la más reciente.
    rows.forEach((r) => map.set(r.id_brief, r.toJSON()));
    return map;
};

// ¿Se puede invalidar (borrar) la propuesta de este brief? Devuelve null si sí, o
// { status, body } con el error a responder si no.
const checkCanInvalidate = async ({ id_brief, user, confirmEditAccepted, transaction }) => {
    const accepted = await md.pdf_planificador.findOne({ where: { id_brief, respuesta: true }, transaction });
    if (!accepted) return null;
    if (!isAdminUser(user)) {
        return {
            status: 403,
            body: {
                code: 'PROPOSAL_ACCEPTED',
                message: 'El cliente ya aceptó esta propuesta. Solo un usuario admin o superadmin puede editarla.',
            },
        };
    }
    if (!confirmEditAccepted) {
        return {
            status: 409,
            body: {
                code: 'PROPOSAL_ACCEPTED_CONFIRM_REQUIRED',
                message: 'El cliente ya aceptó esta propuesta. Editarla borra el registro de lo que aceptó. Se requiere confirmación.',
            },
        };
    }
    return null;
};

// Borra las filas de propuesta del brief y devuelve los nombres de archivo a eliminar
// (se borran del disco recién después de confirmar la transacción: ver removeFiles).
const deleteProposals = async (id_brief, transaction) => {
    const rows = await md.pdf_planificador.findAll({ where: { id_brief }, attributes: ['pdf'], transaction });
    await md.pdf_planificador.destroy({ where: { id_brief }, transaction });
    return rows.map((r) => r.pdf).filter(Boolean);
};

const removeFiles = (filenames) => {
    filenames.forEach((filename) => {
        try {
            fs.unlinkSync(path.join(UPLOADS_PATH, path.basename(filename)));
        } catch {
            // El archivo puede no existir (ya borrado, o fila vieja): no es un error.
        }
    });
};

// Invalida la propuesta del brief (borra fila y archivo) si existe. Para usar fuera de
// una transacción propia (ej. al editar la estrategia). Respeta la regla de "aceptada".
// Devuelve { error } si no se puede, o { invalidated: boolean }.
const invalidateProposal = async ({ id_brief, user, confirmEditAccepted }) => {
    const blocked = await checkCanInvalidate({ id_brief, user, confirmEditAccepted });
    if (blocked) return { error: blocked };
    const filenames = await deleteProposals(id_brief);
    removeFiles(filenames);
    return { invalidated: filenames.length > 0 };
};

module.exports = {
    UPLOADS_PATH,
    isAdminUser,
    findLatest,
    getLatestByBriefIds,
    checkCanInvalidate,
    deleteProposals,
    removeFiles,
    invalidateProposal,
};
