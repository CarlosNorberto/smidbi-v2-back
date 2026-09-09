const md = require('../../models');

const getAll = async (req, res) => {
    try {
        const temperatures = await md.customer_temperature.findAll();
        res.status(200).json(temperatures);
    } catch (error) {
        res.status(500).json({ error: 'Error interno del servidor: ' + error.message });
    }
}

module.exports = {
    getAll
};