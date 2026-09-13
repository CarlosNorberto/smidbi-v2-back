// 'admin' y 'superadmin' tienen acceso total (igual que isAdmin() en el
// resto de la app); solo el rol 'user' se restringe a sus propias campañas.
const isUnrestrictedRole = (currentUser) => {
    return currentUser.role.rol === 'admin' || currentUser.role.rol === 'superadmin';
};

const getUserFilter = (currentUser) => {
    return isUnrestrictedRole(currentUser)
        ? {}
        : { id_usuario: currentUser.id };
};

module.exports = {
    getUserFilter,
    isUnrestrictedRole,
};
