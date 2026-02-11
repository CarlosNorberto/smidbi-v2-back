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
    const t0 = Date.now();

    try {
        const id = req.params.id;

        const card = await md.tasks_cards.findByPk(id);
        if (!card) {
            return res.status(404).json({ message: 'No se encontró la tarjeta' });
        }

        const { list_id, order } = req.body;

        // Determinar si está en la lista 3 (terminado)
        const isCompleted = parseInt(list_id) === 3;

        const updateData = {
            ...req.body,
            completed: isCompleted,            
        };

        await card.update(updateData);

        console.log(`TOTAL: ${Date.now() - t0}ms`);
        return res.status(200).json(card);

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error al actualizar la tarjeta' });
    }
};

module.exports = {
    save,
    update,
};