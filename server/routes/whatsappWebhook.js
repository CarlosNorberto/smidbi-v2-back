const express = require('express');
const router = express.Router();

// 1. Verificación inicial (Meta llama esto UNA vez al guardar la config)
router.get('/webhooks/whatsapp', (req, res) => {
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
        console.log('Webhook verificado correctamente');
        return res.status(200).send(challenge);
    }
    res.sendStatus(403);
});

// 2. Eventos entrantes (estados de mensajes, mensajes recibidos)
router.post('/webhooks/whatsapp', (req, res) => {
    console.log('Evento recibido:', JSON.stringify(req.body, null, 2));
    // Aquí procesas el payload (estado de entrega, mensaje entrante, etc.)
    res.sendStatus(200); // SIEMPRE responde 200 rápido, aunque el procesamiento sea async
});

module.exports = router;
