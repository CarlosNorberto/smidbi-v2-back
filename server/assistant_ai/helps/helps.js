const getUserFilter = (currentUser) => {
    return currentUser.role.rol !== 'admin' 
        ? { id_usuario: currentUser.id } 
        : {};
};

module.exports = { 
    getUserFilter
};