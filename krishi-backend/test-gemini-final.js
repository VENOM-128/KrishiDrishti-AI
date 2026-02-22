const fetch = require('node-fetch');
require('dotenv').config();

const API_KEY = process.env.GOOGLE_API_KEY;

async function testModel(version, model) {
    const url = `https://generativelanguage.googleapis.com/${version}/models/${model}:generateContent?key=${API_KEY}`;
    console.log(`Testing ${url}...`);
    try {
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{ parts: [{ text: "Identify this plant: Wheat" }] }]
            })
        });
        const data = await res.json();
        if (res.ok) {
            console.log(`✅ SUCCESS for ${version}/${model}`);
            return true;
        } else {
            console.log(`❌ FAILED for ${version}/${model}: ${data.error?.message || JSON.stringify(data)}`);
            return false;
        }
    } catch (e) {
        console.log(`💥 ERROR for ${version}/${model}: ${e.message}`);
        return false;
    }
}

async function run() {
    const versions = ['v1', 'v1beta'];
    const models = ['gemini-1.5-flash', 'gemini-1.5-flash-latest', 'gemini-1.5-pro', 'gemini-pro-vision'];

    for (const v of versions) {
        for (const m of models) {
            const ok = await testModel(v, m);
            if (ok) {
                console.log(`FOUND WORKING COMBO: ${v} and ${m}`);
            }
        }
    }
}

run();
