const extractEntities = require('./services/entityExtractor.service');
const getCatalog = require('./services/catalogSearch.service');
const { generateClarification,
    generateNotFound } = require('./services/clarification.service');
const generateResponse = require('./services/responder.service');
const executeTool = require('./tools/executor');
const { getNeeds, getTool, getNeutralQuestion } = require('./config/intents');

async function handleChat(req, res) {
    try {
        const { question, selection_id, selection_type } = req.body;

        if (!question?.trim()) {
            return res.status(400).json({ error: 'Question is required' });
        }

        // ── 1. Extract intent and entities from question ──
        const entities = await extractEntities(question);
        const needs = getNeeds(entities.intent);
        const tool = getTool(entities.intent);

        // ── 2. Employee already selected from a list ──
        if (selection_id) {
            const data = await executeTool([{ tool, params: { campaign_id: selection_id } }]);
            const neutralQuestion = getNeutralQuestion(entities.intent);
            const response = await generateResponse(neutralQuestion, data, true);
            return res.json({ type: 'response', message: response });
        }

        // ── 3. No context needed → go directly to tool ──
        if (needs.length === 0) {
            const data = await executeTool([{ tool, params: { entities, days_ahead: entities.days_ahead ?? 7 } }]);
            const response = await generateResponse(question, data);
            return res.status(200).json({ type: 'response', message: response });
        }

        // ── 4. Search context in DB ──
        const catalog = await getCatalog(entities, needs);

        if (catalog.ambiguous) {
            const message = await generateClarification({
                question,
                options: catalog.options,
                ambiguous_type: catalog.ambiguous_type
            });
            return res.json({ type: 'clarification', message, options: catalog.options });
        }

        if (catalog.not_found) {
            const message = await generateNotFound({
                question,
                entities,
                not_found_type: catalog.not_found_type
            });
            return res.json({ type: 'not_found', message });
        }

        // ── 5. Execute tool with resolved context ──
        const data = await executeTool([{
            tool,
            params: {
                campaign_id: catalog.campaigns[0]?.id,
                company_id: catalog.company?.id,
                entities
            }
        }]);

        // ── 6. Generate final response ──
        const response = await generateResponse(question, data);
        return res.json({ type: 'response', message: response });

    } catch (error) {
        console.error('Error in chat controller:', error);
        res.status(500).json({ error: 'Error processing request' });
    }
}

module.exports = { handleChat };