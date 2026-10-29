const md = require('../models');

// Propiedad de empresas → categorías → campañas → reportes.
// El responsable vive en `empresas.id_usuario` y todo lo que cuelga de la
// empresa hereda esa propiedad. admin/superadmin gestionan todo (igual que
// isUnrestrictedRole en el asistente IA); el resto de roles ('user', 'hidden')
// solo puede modificar lo que cuelga de empresas de las que es responsable.
//
// Se responde 404 y no 403 a propósito: el interceptor de axios del frontend
// redirige al login ante cualquier 403, y para este caso ("no es tu empresa")
// no corresponde cerrar la sesión del usuario.

const isUnrestricted = (user) => ['admin', 'superadmin'].includes(user?.role?.rol);

const canManageCompany = async (user, companyId) => {
    if (isUnrestricted(user)) return true;
    if (!companyId) return false;
    const empresa = await md.empresas.findByPk(companyId, { attributes: ['id', 'id_usuario'] });
    return !!empresa && empresa.id_usuario === user.id;
};

const canManageCategory = async (user, categoryId) => {
    if (isUnrestricted(user)) return true;
    if (!categoryId) return false;
    const categoria = await md.categorias.findByPk(categoryId, { attributes: ['id_empresa'] });
    return !!categoria && canManageCompany(user, categoria.id_empresa);
};

const canManageCampaign = async (user, campaignId) => {
    if (isUnrestricted(user)) return true;
    if (!campaignId) return false;
    const campana = await md.campanas.findByPk(campaignId, { attributes: ['id_categoria'] });
    return !!campana && canManageCategory(user, campana.id_categoria);
};

// Un reporte lo puede gestionar su responsable (`reportes.id_usuario`: es lo que define
// "mis campañas" en el asistente IA y en la búsqueda global) o el responsable de la
// empresa a la que pertenece. Categorías y campañas no tienen un responsable propio
// que se use para filtrar, así que solo se validan por la empresa.
const canManageReport = async (user, reportId) => {
    if (isUnrestricted(user)) return true;
    if (!reportId) return false;
    const reporte = await md.reportes.findByPk(reportId, { attributes: ['id_campana', 'id_usuario'] });
    if (!reporte) return false;
    if (reporte.id_usuario === user.id) return true;
    return canManageCampaign(user, reporte.id_campana);
};

// Responsable (dueño) de la empresa a la que pertenece un registro. Categorías,
// campañas y reportes NUNCA toman como responsable a quien los crea: heredan el de su
// empresa, así que un admin que crea algo en la empresa de A lo deja a nombre de A
// (y A lo ve en "mis campañas", la búsqueda y el seguimiento). Quien lo creó queda
// registrado en `usuario_creacion`. Devuelve null si la cadena no existe.
const getCompanyOwnerId = async (companyId) => {
    if (!companyId) return null;
    const empresa = await md.empresas.findByPk(companyId, { attributes: ['id_usuario'] });
    return empresa ? empresa.id_usuario : null;
};

const getCategoryOwnerId = async (categoryId) => {
    if (!categoryId) return null;
    const categoria = await md.categorias.findByPk(categoryId, { attributes: ['id_empresa'] });
    return categoria ? getCompanyOwnerId(categoria.id_empresa) : null;
};

const getCampaignOwnerId = async (campaignId) => {
    if (!campaignId) return null;
    const campana = await md.campanas.findByPk(campaignId, { attributes: ['id_categoria'] });
    return campana ? getCategoryOwnerId(campana.id_categoria) : null;
};

const denyAccess = (res) =>
    res.status(404).json({ message: 'No se encontró el recurso o no tiene acceso a él.' });

module.exports = {
    isUnrestricted,
    canManageCompany,
    canManageCategory,
    canManageCampaign,
    canManageReport,
    getCompanyOwnerId,
    getCategoryOwnerId,
    getCampaignOwnerId,
    denyAccess,
};
