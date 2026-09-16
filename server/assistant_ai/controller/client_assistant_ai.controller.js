const { getOpenAIClient } = require('../services/openai.service');
const { getClientSummaryRows } = require('../../controllers/campaign_manager/reportes');
const { getFechaActualLaPaz } = require('../../helps');

// Versión del asistente IA para el cliente final (empresa), separada por
// completo del asistente interno (assistant_ai.controller.js): ese usa un
// pipeline de intención/entidades/catálogo pensado para que el staff busque
// entre TODAS las empresas y campañas del sistema — acá no hace falta nada
// de eso, porque el alcance ya es un solo cliente. En vez de reusar ese
// pipeline (y arriesgar filtrar con qué empresa cruzar datos), se le pasan a
// OpenAI directamente los datos YA escoped a `req.session.empresaId`
// (los mismos que arma el Resumen del cliente) — la IA no tiene ninguna
// forma de ver campañas de otra empresa, porque ese dato nunca llega a
// construirse, no porque se le pida que no lo mencione.
async function handleClientChat(req, res) {
    try {
        const { question } = req.body;
        const empresaId = req.session.empresaId;

        if (!question?.trim()) {
            return res.status(400).json({ error: 'La pregunta es obligatoria' });
        }

        const rows = await getClientSummaryRows(empresaId);
        const fechaActual = getFechaActualLaPaz();

        const openai = await getOpenAIClient();
        const response = await openai.chat.completions.create({
            model: 'gpt-4o',
            messages: [
                {
                    role: 'system',
                    content: `Eres el asistente de campañas de una agencia de marketing digital, hablando
                        directamente con un cliente final (no con personal de la agencia).
                        Respóndele siempre de usted, en español neutro, de forma clara y concisa.

                        # DATOS
                        Los "Datos de campañas" que se te dan abajo son SOLO los de la empresa de este
                        cliente — no existen otros datos, de ninguna otra empresa, en esta conversación.

                        # REGLAS

                        1. ALCANCE:
                            SOLO puedes responder sobre las campañas y reportes incluidos en los datos.
                            Si el cliente pregunta por otra empresa, otro cliente, o cualquier tema fuera
                            de sus propias campañas, decline amablemente y aclare que solo puede ayudarlo
                            con la información de su propia empresa.
                            Si pregunta algo totalmente ajeno a marketing/campañas, decline amablemente.

                        2. NOMBRES:
                            Usa siempre el nombre exacto de "campana_nombre" y "formato" tal cual están en
                            los datos, sin abreviar ni modificar.

                        3. TÉRMINOS TÉCNICOS:
                            Nunca menciones nombres de campos como: campaign_id, campana_id, reporte_id,
                            categoria_id, id_objetivo. Tradúcelos a lenguaje natural.

                        4. CIFRAS:
                            Redondea montos y porcentajes a una forma legible. Incluye la moneda ("moneda")
                            cuando menciones montos.

                        5. FECHAS RELATIVAS:
                            Hoy es ${fechaActual}. Úsalo para responder preguntas sobre campañas activas,
                            próximas a vencer, del mes actual, etc. — comparando contra "fecha_ini"/"fecha_fin"
                            de cada reporte. No asumas otra fecha.

                        6. Si no tiene suficiente información en los datos para responder, dígalo con
                            claridad en vez de inventar algo.

                        No ofrezcas información adicional a la que se te pidió.`,
                },
                {
                    role: 'user',
                    content: `Hoy es ${fechaActual}.\nPregunta del cliente: "${question}"\nDatos de campañas de su empresa: ${JSON.stringify(rows, null, 2)}`,
                },
            ],
            max_tokens: 800,
        });

        const message = response.choices[0].message.content;
        return res.status(200).json({ message });
    } catch (error) {
        console.error('Error in client chat controller:', error);
        res.status(500).json({ error: 'Ocurrió un error al procesar la pregunta' });
    }
}

module.exports = { handleClientChat };
