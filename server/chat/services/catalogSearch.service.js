const { Op } = require('sequelize');
const md = require('../../models');

const getCatalog = async (entities, necesita) => {
    try {
        let empresa = null;

        // ── Buscar empresa solo si la intención lo requiere ──
        if (necesita.includes('empresa')) {

            if (!entities.nombre_empresa) {
                // La intención necesita empresa pero el empleado no la mencionó
                return {
                    ambiguo: false,
                    empresa: null,
                    campanas: [],
                    sin_empresa: true
                };
            }

            const empresas = await md.empresas.findAll({
                where: {
                    activo: true,
                    nombre: { [Op.iLike]: `%${entities.nombre_empresa}%` }
                },
                attributes: ['id', 'nombre']
            });

            if (empresas.length === 0) {
                return {
                    ambiguo: false,
                    empresa: null,
                    campanas: [],
                    sin_resultados: true,
                    tipo_no_encontrado: 'empresa'
                };
            }

            if (empresas.length > 1) {
                return {
                    ambiguo: true,
                    tipo_ambiguo: 'empresa',
                    opciones: empresas.map(e => ({
                        id: e.id,
                        label: e.nombre,
                        tipo: 'empresa'
                    }))
                };
            }

            empresa = empresas[0];
        }

        // ── Buscar campañas solo si la intención lo requiere ──
        if (!necesita.includes('campana')) {
            return { ambiguo: false, empresa, campanas: [] };
        }

        const whereReporte = { activo: true };
        const whereCampana = {};
        const whereEmpresa = { activo: true };

        if (empresa) {
            whereEmpresa.id = empresa.id;
        }
        if (entities.nombre_campana) {
            whereReporte.nombre = { [Op.iLike]: `%${entities.nombre_campana}%` };
        }
        if (entities.plataforma) {
            whereCampana.plataforma = { [Op.iLike]: `%${entities.plataforma}%` };
        }
        if(entities.anio){
            whereReporte.fecha_ini = { 
                [Op.between]: [`${entities.anio}-01-01`, `${entities.anio}-12-31`]
            };
        }else if(entities.fecha_inicio && entities.fecha_final){
            whereReporte.fecha_ini = { [Op.gte]: entities.fecha_inicio };
            whereReporte.fecha_fin = { [Op.lte]: entities.fecha_final };
        }

        const reportes = await md.reportes.findAll({
            where: whereReporte,
            attributes: ['id', 'nombre', 'id_campana', 'fecha_ini', 'fecha_fin'],
            include: [
                {
                    model: md.campanas,
                    as: 'campana',
                    required: true,
                    where: Object.keys(whereCampana).length ? whereCampana : undefined,
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
                                    where: whereEmpresa,
                                    attributes: ['id', 'nombre']
                                }
                            ]
                        }
                    ]
                }
            ]
        });

        if (reportes.length === 0) {
            return {
                ambiguo: false,
                empresa,
                campanas: [],
                sin_resultados: true,
                tipo_no_encontrado: 'campana'
            };
        }

        if (reportes.length > 1) {
            return {
                ambiguo: true,
                tipo_ambiguo: 'campana',
                empresa,
                // Este array es el que el FRONTEND usa para armar los botones
                opciones: reportes.map(r => ({
                    id: r.id,
                    label: r.nombre,
                    detalle: `Emp.: ${r.campana?.categoria?.empresa?.nombre} › Cat.: ${r.campana?.categoria?.nombre} › Camp.: ${r.campana?.nombre}`,
                    periodo: r.fecha_ini && r.fecha_fin ? `${formatDate(r.fecha_ini)} - ${formatDate(r.fecha_fin)}` : 'Sin periodo',
                    tipo: 'reporte'
                }))
            };
        }

        // Caso ideal — resultado único
        return { ambiguo: false, empresa, campanas: reportes };

    } catch (error) {
        console.error('Error en getCatalog:', error);
        throw new Error('Error al obtener el catálogo');
    }
};

const formatDate = (fecha) => {
    if (!fecha) return 'N/A';
    const [anio, mes, dia] = fecha.split('T')[0].split('-');
    return `${dia}/${mes}/${anio}`;
};

module.exports = { getCatalog };