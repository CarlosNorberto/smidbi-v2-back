const md = require('../../models');

const getByCardId = async (req, res) => {
    try {
        const { card_id, report_id } = req.params;

        const ad = await md.tasks_ads.findOne({
            where: {
                card_id: card_id
            },
            attributes: ['id', 'card_id', 'material_links', 'platform_links', 'cta_ad', 'seg_segmentations', 'seg_ages', 'seg_cities']
        });        
        if (ad) {
            res.status(200).json(ad);
        } else {
            const segmentacion = await md.segmentacion.findOne({
                where: {
                    activo: true,
                    id_reporte: report_id
                },
            });
            res.status(200).json({
                card_id: card_id,
                material_links: null,
                platform_links: null,
                cta_ad: null,
                seg_segmentations: segmentacion.segmentacion ? segmentacion.segmentacion : null,
                seg_ages: segmentacion.demografia ? segmentacion.demografia : null,
                seg_cities: segmentacion.geo_segmentacion ? segmentacion.geo_segmentacion : null
            });            
        }        
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el anuncio: ${error.message}` });
    }
};

const saveUpdate = async (req, res) => {
    try {
        const { card_id, material_links, platform_links, cta_ad, segmentacion, demografia, geo_segmentacion } = req.body;
        let segmentacionRecord;
        if (card_id) {
            segmentacionRecord = await md.tasks_ads.findOne({ where: { card_id } });
            if (segmentacionRecord) {
                await segmentacionRecord.update({
                    material_links: material_links,
                    platform_links: platform_links,
                    cta_ad: cta_ad,
                    seg_segmentations: segmentacion,
                    seg_ages: demografia,
                    seg_cities: geo_segmentacion,
                });
            } else {
                segmentacionRecord = await md.tasks_ads.create({
                    card_id: card_id,
                    material_links: material_links,
                    platform_links: platform_links,
                    cta_ad: cta_ad,
                    seg_segmentations: segmentacion,
                    seg_ages: demografia,
                    seg_cities: geo_segmentacion,
                });
            }
        } else {
            return res.status(400).json({ message: 'El card_id es obligatorio' });
        }
        res.status(200).json(segmentacionRecord);
    } catch (error) {
        res.status(500).json({ message: `Error al guardar la segmentación: ${error.message}` });
    }
};

module.exports = {
    getByCardId,
    saveUpdate
};