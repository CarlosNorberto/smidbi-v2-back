const { entityExtractorPrompt } = require('./services/entityExtractor.service');
const { interpretQuestion } = require('./services/interpreter.service');
const { generateResponse } = require('./services/responder.service');
const getCampaignStatus = require('./tools/getCampaignStatus.tool');
const { getCatalog } = require('./tools/getCatalog.tool');

const toolMap = {
    get_campaign_status: getCampaignStatus,
};

async function handleChat(req, res) {
    try {
        const { pregunta } = req.body;
        
        if (!pregunta) {
            return res.status(400).json({ message: 'La pregunta es requerida' });
        }

        const entidades = await entityExtractorPrompt(pregunta);
        console.log('Entidades extraídas:', entidades);

        const catalogo = await getCatalog(entidades);

        const interpretacion = await interpretQuestion(pregunta, catalogo);

        if (interpretacion.tipo === 'direct_response') {
            return res.status(200).json({ respuesta: interpretacion.mensaje });
        }

        const datosRecopilados = {};
        for (const call of interpretacion.calls) {
            const toolFn  = toolMap[call.herramienta];
            if (toolFn) {
                datosRecopilados[call.herramienta] = await toolFn(call.parametros);
            }
        }

        const respuesta = await generateResponse(pregunta, datosRecopilados);
        res.status(200).json({ respuesta });

    } catch (error) {
        console.error('Error en el chat:', error);
        res.status(500).json({ message: 'Error interno del servidor' });
    }
}

module.exports = {
    handleChat
};