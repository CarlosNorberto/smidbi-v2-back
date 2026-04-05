const { sessionAuth } = require('../../auth/middleware');
const assistant_ai_controller = require('../controller/assistant_ai.controller');

module.exports = (app) => {
    // CHATBOT
    app.post(process.env.PREFIX_API + '/assistant_ai/question', sessionAuth, assistant_ai_controller.handleChat);

};