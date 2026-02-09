const md = require('../../models');

const save = async (req, res) => {
    try {
        const body = req.body;
        const newCard = await md.tasks_cards.create(body);
        res.status(201).json(newCard);
    } catch (error) {
        res.status(500).json({ message: 'Error al crear la tarjeta' });
    }
};

const update = async (req, res) => {
    try {
        const id = req.params.id;
        const card = await md.tasks_cards.findByPk(id);
        if (!card) return res.status(404).json({ message: 'No se encontró la tarjeta' });
        req.body.completed = req.body.list_id && parseInt(req.body.list_id) === 3 ? true : false;
        await card.update(req.body);
        res.status(200).json(card);
    } catch (error) {
        res.status(500).json({ message: 'Error al actualizar la tarjeta' });
    }
};

module.exports = {
    save,
    update,
};