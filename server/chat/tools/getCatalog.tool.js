const md = require('../../models');
const { Op } = require('sequelize');

const getCatalog = async (entities) => {
    try {       
        const empresa = await md.empresas.findOne({
            where: {
                activo: true,
                nombre: { [Op.iLike]: `${entities.nombre_empresa || ''}` }
            },
            attributes: ['id', 'nombre', 'descripcion']
        });
        const reportes = await md.reportes.findAll({
            where: { 
                activo: true,
                nombre: { [Op.iLike]: `${entities.nombre_campana || ''}` }
            },
            attributes: ['id', 'nombre', 'id_campana'],
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
                                    where: {
                                        id: empresa ? empresa.id : null
                                    },
                                    attributes: ['id', 'nombre'],
                                    required: true
                                }
                            ]
                        }
                    ]
                },
            ]
        });
        return { empresa, campaña: reportes };
    } catch (error) {
        console.error('Error al obtener el catálogo:', error);
        throw new Error('Error al obtener el catálogo');
    }
}

module.exports = {
    getCatalog
};