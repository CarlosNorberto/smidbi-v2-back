const md = require('../../models');

const getAll = async (req,res) =>{
    try {
        const status = await md.application_status.findAll({
            order:[['application_status_name', 'ASC']]
        })
        res.status(200).json(status);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
}

module.exports = {
    getAll
}