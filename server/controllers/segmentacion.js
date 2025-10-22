const md = require('../models');

const getAllByReportId = async (req, res) => {
    try {
        const { report_id } = req.params;
        const segmentaciones = await md.segmentacion.findOne({
            where: {
                activo: true,
                id_reporte: report_id
            },            
            attributes: ['id', 'id_reporte', 'segmentacion', 'demografia', 'geo_segmentacion', 'retargeting', 'learning', 'palabras_clave']
        });
        res.status(200).json(segmentaciones);
    } catch (error) {
        res.status(500).json({ message: `Error al obtener las segmentaciones: ${error.message}` });
    }   
};

const saveUpdate = async (req, res) => {
    try {
        const { id_reporte, segmentacion, demografia, geo_segmentacion, retargeting, learning, palabras_clave } = req.body;
        let segmentacionRecord;
        if (id_reporte) {
            segmentacionRecord = await md.segmentacion.findOne({ where: { id_reporte } });
            if (segmentacionRecord) {
                await segmentacionRecord.update({ 
                    segmentacion: segmentacion, demografia, geo_segmentacion, retargeting, learning, palabras_clave });
            } else {
                segmentacionRecord = await md.segmentacion.create({ id_reporte, segmentacion, demografia, geo_segmentacion, retargeting, learning, palabras_clave, activo: true });
            }
        } else {
            return res.status(400).json({ message: 'El id_reporte es obligatorio' });
        }
        res.status(200).json(segmentacionRecord);
    } catch (error) {
        res.status(500).json({ message: `Error al guardar la segmentación: ${error.message}` });
    }
};

module.exports = {
    getAllByReportId,
    saveUpdate
};