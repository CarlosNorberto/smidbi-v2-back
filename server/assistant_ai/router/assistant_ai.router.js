const { sessionAuth, clientSessionAuth } = require('../../auth/middleware');
const assistant_ai_controller = require('../controller/assistant_ai.controller');
const client_assistant_ai_controller = require('../controller/client_assistant_ai.controller');

module.exports = (app) => {
    // CHATBOT (staff interno)
    app.post(process.env.PREFIX_API + '/assistant_ai/question', sessionAuth, assistant_ai_controller.handleChat);

    // CHATBOT (cliente final, scoped a su propia empresa)
    app.post(process.env.PREFIX_API + '/assistant_ai/client_question', clientSessionAuth, client_assistant_ai_controller.handleClientChat);

};