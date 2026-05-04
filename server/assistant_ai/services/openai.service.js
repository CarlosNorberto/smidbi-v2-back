const fetch = require('node-fetch')
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  fetch: fetch
});

module.exports = openai;