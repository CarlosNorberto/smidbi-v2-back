const md = require('../models');
const { Op } = require('sequelize');

// Las campañas guardan la moneda como texto libre ('$us', '$us.', 'Bs.'...).
// Se normaliza a USD/BOB para poder sumar presupuestos sin mezclar monedas.
const CURRENCY_LABELS = { USD: '$us', BOB: 'Bs' };
const normalizeCurrency = (moneda) => (/^bs/i.test((moneda || '').trim()) ? 'BOB' : 'USD');

const round2 = (n) => parseFloat(n.toFixed(2));

// Clientes (empresas) activos: empresas con `activo: true` que tienen al menos
// una campaña (reporte) activa y vigente hoy. Es la consulta única que usan
// tanto la sección de Reportes como el consultor IA (tool get_active_clients).
//
// Cada cliente trae su presupuesto desglosado por moneda (`budgets`), porque
// cada campaña tiene la suya y no se pueden sumar $us con Bs.
//
// `userId` es opcional: si viene, solo cuenta las campañas asignadas a ese
// usuario (rol 'user' en el consultor IA). La sección de Reportes no lo usa.
const fetchActiveClients = async ({ userId } = {}) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const reportes = await md.reportes.findAll({
        where: {
            activo: true,
            fecha_ini: { [Op.lte]: today },
            fecha_fin: { [Op.gte]: today },
            ...(userId ? { id_usuario: userId } : {})
        },
        attributes: ['id', 'presupuesto', 'ejecutado'],
        include: [
            {
                model: md.campanas,
                as: 'campana',
                required: true,
                attributes: ['id', 'moneda'],
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

    const porEmpresa = {};
    reportes.forEach((reporte) => {
        const empresa = reporte.campana.categoria.empresa;
        const currency = normalizeCurrency(reporte.campana.moneda);

        if (!porEmpresa[empresa.id]) {
            porEmpresa[empresa.id] = {
                company_id: empresa.id,
                company_name: empresa.nombre,
                active_campaigns: 0,
                budgets: {}
            };
        }
        const cliente = porEmpresa[empresa.id];
        cliente.active_campaigns++;

        if (!cliente.budgets[currency]) {
            cliente.budgets[currency] = { currency: CURRENCY_LABELS[currency], active_campaigns: 0, total: 0, executed: 0 };
        }
        const budget = cliente.budgets[currency];
        budget.active_campaigns++;
        budget.total += parseFloat(reporte.presupuesto) || 0;
        budget.executed += parseFloat(reporte.ejecutado) || 0;
    });

    const clients = Object.values(porEmpresa)
        .map((c) => ({
            ...c,
            budgets: Object.values(c.budgets)
                .map((b) => ({
                    ...b,
                    total: round2(b.total),
                    executed: round2(b.executed),
                    progress_percent: b.total > 0 ? parseFloat((b.executed / b.total * 100).toFixed(1)) : 0
                }))
                .sort((a, b) => a.currency.localeCompare(b.currency))
        }))
        .sort((a, b) => b.active_campaigns - a.active_campaigns || a.company_name.localeCompare(b.company_name));

    return { clients, total_campaigns: reportes.length };
};

// Definición del reporte para la sección de Reportes (no recibe parámetros).
// Una fila por cliente y moneda: un cliente con campañas en $us y en Bs aparece
// en dos filas, cada una con montos coherentes.
const report = {
    id: 'clientes-activos',
    title: 'Clientes activos',
    description: 'Clientes con al menos una campaña activa y vigente hoy, con su presupuesto y avance por moneda.',
    params: [],
    build: async () => {
        const { clients, total_campaigns } = await fetchActiveClients();

        const rows = clients.flatMap((c) =>
            c.budgets.map((b) => ({
                company_id: c.company_id,
                company_name: c.company_name,
                currency: b.currency,
                active_campaigns: b.active_campaigns,
                budget_total: b.total,
                budget_executed: b.executed,
                progress_percent: b.progress_percent
            }))
        );

        const totalsByCurrency = {};
        rows.forEach((r) => {
            if (!totalsByCurrency[r.currency]) totalsByCurrency[r.currency] = { total: 0, executed: 0 };
            totalsByCurrency[r.currency].total += r.budget_total;
            totalsByCurrency[r.currency].executed += r.budget_executed;
        });

        const summary = [
            { key: 'total_clients', label: 'Clientes activos', value: clients.length, type: 'integer' },
            { key: 'total_campaigns', label: 'Campañas vigentes', value: total_campaigns, type: 'integer' }
        ];
        Object.keys(totalsByCurrency).sort().forEach((currency) => {
            const t = totalsByCurrency[currency];
            summary.push(
                { key: `budget_total_${currency}`, label: `Presupuesto total (${currency})`, value: round2(t.total), type: 'money' },
                { key: `budget_executed_${currency}`, label: `Ejecutado total (${currency})`, value: round2(t.executed), type: 'money' }
            );
        });

        return {
            columns: [
                { key: 'company_name', title: 'Cliente', type: 'text' },
                { key: 'currency', title: 'Moneda', type: 'text' },
                { key: 'active_campaigns', title: 'Campañas activas', type: 'integer' },
                { key: 'budget_total', title: 'Presupuesto', type: 'money' },
                { key: 'budget_executed', title: 'Ejecutado', type: 'money' },
                { key: 'progress_percent', title: 'Avance (%)', type: 'percent' }
            ],
            rows,
            summary
        };
    }
};

module.exports = { report, fetchActiveClients };
