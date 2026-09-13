const md = require('../../models');
const { Op } = require('sequelize');
const { getUserFilter, isUnrestrictedRole } = require('../helps/helps');

// Resumen de presupuesto de todas las campañas activas y vigentes (o solo las
// del usuario actual si no es admin), agrupado por empresa.
const getGlobalBudget = async ({ currentUser }) => {
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
            attributes: ['id', 'nombre', 'presupuesto', 'ejecutado'],
            include: [
                {
                    model: md.campanas,
                    as: 'campana',
                    required: true,
                    attributes: ['id', 'nombre'],
                    include: [
                        {
                            model: md.categorias,
                            as: 'categoria',
                            required: true,
                            attributes: ['id', 'nombre'],
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
                total_campaigns: 0,
                budget: { total: 0, executed: 0, progress_percent: 0 },
                by_company: [],
                message: isUnrestrictedRole(currentUser)
                    ? 'No hay campañas activas en el sistema en este momento'
                    : 'No tienes campañas activas asignadas en este momento'
            };
        }

        const porEmpresa = {};
        reportes.forEach((reporte) => {
            const empresa = reporte.campana.categoria.empresa.nombre;
            const empresaId = reporte.campana.categoria.empresa.id;
            const total = parseFloat(reporte.presupuesto) || 0;
            const executed = parseFloat(reporte.ejecutado) || 0;

            if (!porEmpresa[empresaId]) {
                porEmpresa[empresaId] = {
                    company_id: empresaId,
                    company_name: empresa,
                    total_campaigns: 0,
                    budget: { total: 0, executed: 0 }
                };
            }
            porEmpresa[empresaId].total_campaigns++;
            porEmpresa[empresaId].budget.total += total;
            porEmpresa[empresaId].budget.executed += executed;
        });

        const byCompany = Object.values(porEmpresa)
            .map((empresa) => ({
                ...empresa,
                budget: {
                    total: parseFloat(empresa.budget.total.toFixed(2)),
                    executed: parseFloat(empresa.budget.executed.toFixed(2)),
                    progress_percent: empresa.budget.total > 0
                        ? parseFloat((empresa.budget.executed / empresa.budget.total * 100).toFixed(1))
                        : 0
                }
            }))
            .sort((a, b) => b.budget.total - a.budget.total);

        const totalBudget = byCompany.reduce((s, c) => s + c.budget.total, 0);
        const totalExecuted = byCompany.reduce((s, c) => s + c.budget.executed, 0);

        return {
            context: isUnrestrictedRole(currentUser)
                ? 'Todas las campañas activas del sistema'
                : `Campañas asignadas a ${currentUser.nombre}`,
            total_campaigns: reportes.length,
            total_companies: byCompany.length,
            budget: {
                total: parseFloat(totalBudget.toFixed(2)),
                executed: parseFloat(totalExecuted.toFixed(2)),
                progress_percent: totalBudget > 0
                    ? parseFloat((totalExecuted / totalBudget * 100).toFixed(1))
                    : 0
            },
            by_company: byCompany
        };

    } catch (error) {
        console.error('Error in getGlobalBudget:', error);
        throw new Error('Error fetching global budget: ' + error.message);
    }
};

module.exports = getGlobalBudget;
