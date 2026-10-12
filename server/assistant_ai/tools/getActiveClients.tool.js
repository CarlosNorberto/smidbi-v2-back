const { fetchActiveClients } = require('../../reports/clientesActivos.report');
const { isUnrestrictedRole } = require('../helps/helps');

// Listado de clientes (empresas) activos para el consultor IA. La consulta es
// la misma del reporte "Clientes activos" (server/reports); acá solo se
// restringe a las campañas del usuario si no es admin/superadmin.
const getActiveClients = async ({ currentUser }) => {
    try {
        const unrestricted = isUnrestrictedRole(currentUser);
        const { clients, total_campaigns } = await fetchActiveClients({
            userId: unrestricted ? undefined : currentUser.id
        });

        if (!clients.length) {
            return {
                total_clients: 0,
                clients: [],
                message: unrestricted
                    ? 'No hay clientes con campañas activas en el sistema en este momento'
                    : 'No tienes clientes con campañas activas asignadas en este momento'
            };
        }

        return {
            context: unrestricted
                ? 'Todos los clientes con campañas activas del sistema'
                : `Clientes con campañas asignadas a ${currentUser.nombre}`,
            total_clients: clients.length,
            total_campaigns,
            clients
        };

    } catch (error) {
        console.error('Error in getActiveClients:', error);
        throw new Error('Error fetching active clients: ' + error.message);
    }
};

module.exports = getActiveClients;
