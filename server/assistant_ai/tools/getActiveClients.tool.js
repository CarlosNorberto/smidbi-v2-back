const md = require('../../models');
const { Op } = require('sequelize');
const { getUserFilter, isUnrestrictedRole } = require('../helps/helps');

// Listado de clientes (empresas) activos: empresas con `activo: true` que
// tienen al menos una campaña vigente (o solo las del usuario actual si no es
// admin), con cantidad de campañas y presupuesto por cliente.
const getActiveClients = async ({ currentUser }) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const reportes = await md.reportes.findAll({
            where: {
                activo: true,
                fecha_ini: { [Op.lte]: today },
                fecha_fin: { [Op.gte]: today },
                ...getUserFilter(currentUser)
            },
            attributes: ['id', 'presupuesto', 'ejecutado'],
            include: [
                {
                    model: md.campanas,
                    as: 'campana',
                    required: true,
                    attributes: ['id'],
                    include: [
                        {
                            model: md.categorias,
                            as: 'categoria',
                            required: true,
                            attributes: ['id'],
                            include: [
                                {
                                    model: md.empresas,
                                    as: 'empresa',
                                    required: true,
                                    where: { activo: true },
                                    attributes: ['id', 'nombre']
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        if (!reportes.length) {
            return {
                total_clients: 0,
                clients: [],
                message: isUnrestrictedRole(currentUser)
                    ? 'No hay clientes con campañas activas en el sistema en este momento'
                    : 'No tienes clientes con campañas activas asignadas en este momento'
            };
        }

        const porEmpresa = {};
        reportes.forEach((reporte) => {
            const empresa = reporte.campana.categoria.empresa;
            if (!porEmpresa[empresa.id]) {
                porEmpresa[empresa.id] = {
                    company_id: empresa.id,
                    company_name: empresa.nombre,
                    active_campaigns: 0,
                    budget_total: 0,
                    budget_executed: 0
                };
            }
            const cliente = porEmpresa[empresa.id];
            cliente.active_campaigns++;
            cliente.budget_total += parseFloat(reporte.presupuesto) || 0;
            cliente.budget_executed += parseFloat(reporte.ejecutado) || 0;
        });

        const clients = Object.values(porEmpresa)
            .map((c) => ({
                ...c,
                budget_total: parseFloat(c.budget_total.toFixed(2)),
                budget_executed: parseFloat(c.budget_executed.toFixed(2)),
                progress_percent: c.budget_total > 0
                    ? parseFloat((c.budget_executed / c.budget_total * 100).toFixed(1))
                    : 0
            }))
            .sort((a, b) => b.active_campaigns - a.active_campaigns || a.company_name.localeCompare(b.company_name));

        return {
            context: isUnrestrictedRole(currentUser)
                ? 'Todos los clientes con campañas activas del sistema'
                : `Clientes con campañas asignadas a ${currentUser.nombre}`,
            total_clients: clients.length,
            total_campaigns: reportes.length,
            clients
        };

    } catch (error) {
        console.error('Error in getActiveClients:', error);
        throw new Error('Error fetching active clients: ' + error.message);
    }
};

module.exports = getActiveClients;
