const express = require('express');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors()); // Allow frontend to talk to backend
app.use(express.json()); // Parse JSON bodies
app.use(express.static('../')); // Serve static files from the root directory (where index.html is)

// --- DATABASE (Moved from Frontend) ---
const MARKET_DATA = {
    'Wheat': {
        'Azadpur (Delhi)': { current: 2150, peak: 2340, trend: [2100, 2150, 2180, 2240, 2300, 2280, 2340] },
        'Vashi (Mumbai)': { current: 2280, peak: 2450, trend: [2220, 2280, 2310, 2370, 2420, 2400, 2450] }
    },
    'Rice': {
        'Azadpur (Delhi)': { current: 3500, peak: 3800, trend: [3400, 3450, 3500, 3600, 3650, 3750, 3800] }
    }
};

const DISEASE_DB = {
    'Wheat': {
        'yellowing': {
            name: 'Yellow Rust',
            cause: 'Fungal Infection',
            chemical: 'Propiconazole 25% EC',
            organic: 'Neem Oil (3%) spray'
        }
    },
    'Rice': {
        'spots': {
            name: 'Brown Spot',
            cause: 'Fungal (Bipolaris oryzae)',
            chemical: 'Mancozeb 75 WP',
            organic: 'Pseudomonas fluorescens'
        }
    }
};

// --- ROUTES ---

// 1. Spoilage Prediction Route (Logic moved to backend)
app.post('/api/predict-spoilage', (req, res) => {
    const { temp, humidity, days } = req.body;
    
    // Heuristic Model Logic
    let risk = (parseFloat(temp) * 0.8) + (parseFloat(humidity) * 0.5) + (parseInt(days) * 1.5);
    risk = Math.min(Math.max(risk - 20, 5), 99);
    
    const isHighRisk = risk > 50;
    const recommendation = isHighRisk 
        ? `Critical humidity. Reduce storage temp to ${(temp - 5).toFixed(1)}°C immediately.`
        : `Conditions optimal. Safe to store for ${Math.max(0, 30 - (temp / 2)).toFixed(0)} more days.`;

    res.json({ risk, isHighRisk, recommendation });
});

// 2. Market Data Route (Data moved to backend)
app.get('/api/market', async (req, res) => {
    const { crop, region } = req.query;
    
    // Check internal "Database" first
    if (MARKET_DATA[crop] && MARKET_DATA[crop][region]) {
        return res.json(MARKET_DATA[crop][region]);
    }

    // If not found, use Gemini AI to estimate (Secure Server-Side Call)
    try {
        const prompt = `Generate realistic market price data for ${crop} in ${region} India. Return JSON: { "current": number, "peak": number, "trend": [7 numbers] }`;
        const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        
        const data = await aiResponse.json();
        
        // Handle potential errors from Gemini API
        if (data.error) {
            console.error("Gemini API Error:", data.error);
            return res.status(500).json({ error: "AI service disabled" });
        }

        const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
        if (!text) {
             return res.status(500).json({ error: "Invalid AI response" });
        }

        const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
        
        res.json(JSON.parse(cleanJson));
    } catch (error) {
        console.error("AI Fetch Error:", error);
        res.status(500).json({ error: "Failed to fetch market data" });
    }
});

// 3. Disease Diagnosis Route
app.get('/api/disease', (req, res) => {
    const { crop, symptom } = req.query;
    
    if (DISEASE_DB[crop] && DISEASE_DB[crop][symptom]) {
        res.json(DISEASE_DB[crop][symptom]);
    } else {
        res.status(404).json({ error: "Disease not found in database" });
    }
});

// 4. Weather Proxy (Hides API implementation details)
app.get('/api/weather', async (req, res) => {
    const { lat, lng } = req.query;
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m`);
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: "Weather service unavailable" });
    }
});

// 5. AI Analyze Route (Proxy for Gemini)
app.post('/api/ai/analyze', async (req, res) => {
    const { prompt } = req.body;
    try {
        const aiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });
        const data = await aiResponse.json();
         // Handle potential errors from Gemini API
        if (data.error) {
             console.error("Gemini API Error:", data.error);
            return res.status(500).json({ error: data.error.message || "AI service error" });
        }
        res.json(data);
    } catch (error) {
        console.error("AI Analyze Error:", error);
         res.status(500).json({ error: "Failed to analyze with AI" });
    }
});


// Start Server
app.listen(PORT, () => {
    console.log(`✅ Backend running at http://localhost:${PORT}`);
});
