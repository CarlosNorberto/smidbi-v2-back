const md = require('../../models');
const { canEditCard, EDIT_DENIED } = require('./tasks_cards');

const getByCardId = async (req, res) => {
    try {
        const { card_id, report_id } = req.params;

        const ad = await md.tasks_ads.findOne({
            where: {
                card_id: card_id
            },
            attributes: ['id', 'card_id', 'material_links', 'platform_links', 'cta_ad', 'template', 'seg_segmentations', 'seg_ages', 'seg_cities']
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
            // Si el reporte no tiene segmentación cargada (lo común en reportes nuevos), la pieza empieza vacía. Antes esto lanzaba
            // un error 500 y el frontend reintentaba 3 veces (≈7 s) antes de mostrar la pieza: por eso "tardaba mucho en cargar".
            res.status(200).json({
                card_id: card_id,
                material_links: null,
                platform_links: null,
                cta_ad: null,
                template: null,
                seg_segmentations: segmentacion?.segmentacion ?? null,
                seg_ages: segmentacion?.demografia ?? null,
                seg_cities: segmentacion?.geo_segmentacion ?? null
            });          
        }        
    } catch (error) {
        res.status(500).json({ message: `Error al obtener el anuncio: ${error.message}` });
    }
};

const saveUpdate = async (req, res) => {
    try {
        const { card_id, material_links, platform_links, cta_ad, template, segmentacion, demografia, geo_segmentacion } = req.body;
        let segmentacionRecord;
        if (card_id) {
            // Editar la pieza es de quien creó la tarea o de un administrador (la pantalla ya lo respeta; antes el servidor no).
            const card = await md.tasks_cards.findByPk(card_id, { attributes: ['id', 'user_id'] });
            if (!card) return res.status(404).json({ message: 'No se encontró la tarjeta' });
            if (!canEditCard(req.user, card)) return res.status(400).json(EDIT_DENIED);
            // Las segmentaciones son listas de textos: un texto suelto daba 500 ("values.map is not a function").
            const isTextList = (v) => v === undefined || v === null || (Array.isArray(v) && v.every((x) => typeof x === 'string'));
            if (![segmentacion, demografia, geo_segmentacion].every(isTextList)) {
                return res.status(400).json({ message: 'Las segmentaciones deben ser listas de textos.' });
            }
            const isText = (v) => v === undefined || v === null || typeof v === 'string';
            if (![material_links, platform_links, cta_ad].every(isText)) {
                return res.status(400).json({ message: 'Los datos de la pieza deben ser texto.' });
            }
            // `template` (la plantilla de creación de campaña) es un objeto JSON.
            if (template !== undefined && template !== null && (typeof template !== 'object' || Array.isArray(template))) {
                return res.status(400).json({ message: 'La plantilla de la pieza no es válida.' });
            }
            segmentacionRecord = await md.tasks_ads.findOne({ where: { card_id } });
            if (segmentacionRecord) {
                await segmentacionRecord.update({
                    material_links: material_links,
                    platform_links: platform_links,
                    cta_ad: cta_ad,
                    ...(template !== undefined && { template }),
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
                    template: template ?? null,
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
        res.status(500).json({ message: `Error al guardar el anuncio asociado a la tarjeta: ${error.message}` });
    }
};

const deleteByCardId = async (req, res) => {
    try {
        const { card_id } = req.params;
        const card = await md.tasks_cards.findByPk(card_id, { attributes: ['id', 'user_id'] });
        if (card && !canEditCard(req.user, card)) return res.status(400).json(EDIT_DENIED);
        const deleted = await md.tasks_ads.destroy({ where: { card_id } });
        if (deleted) {
            res.status(200).json({ message: 'Anuncio asociado a la tarjeta eliminado correctamente' });
        } else {            
            res.status(404).json({ message: 'No se encontró el anuncio para eliminar' });
        }
    } catch (error) {
        res.status(500).json({ message: `Error al eliminar el anuncio asociado a la tarjeta: ${error.message}` });
    }
};


module.exports = {
    getByCardId,
    saveUpdate,
    deleteByCardId
};