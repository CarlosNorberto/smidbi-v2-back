const md = require('../../models');

const saveUpdate = async (req, res) => {
    try {
        const { card_id, material_links, platform_links, cta_ad, segmentacion, demografia, geo_segmentacion} = req.body;
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
    saveUpdate
};