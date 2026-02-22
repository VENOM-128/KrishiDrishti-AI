const fetch = require('node-fetch');
require('dotenv').config();

const API_KEY = process.env.GROQ_API_KEY;

async function run() {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
        headers: { 'Authorization': `Bearer ${API_KEY}` }
    });
    const data = await res.json();
    console.log(JSON.stringify(data.data.map(m => m.id), null, 2));
}

run();
