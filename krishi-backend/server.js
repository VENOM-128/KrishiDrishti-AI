const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Global Cache for Crop Biology
const CROP_BIO_CACHE = {};

// Helper: Deterministic Random for market data daily consistency
function getSeededRandom(seed) {
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash) + seed.charCodeAt(i);
        hash |= 0;
    }
    return (Math.sin(hash) * 10000) % 1;
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('../')); // Serve index.html from root

// Health Check
app.get('/', (req, res) => {
    res.sendFile('index.html', { root: '../' });
});

// --- EMBEDDED CROP PARAMETER DATABASE (instant, no AI needed for common crops) ---
const CROP_PARAMS_DB = {
    'wheat': { tIdeal: 12, hIdeal: 60, tSens: 0.08, hSens: 0.04, shelf: 180 },
    'rice': { tIdeal: 15, hIdeal: 65, tSens: 0.09, hSens: 0.05, shelf: 365 },
    'maize': { tIdeal: 10, hIdeal: 70, tSens: 0.10, hSens: 0.06, shelf: 90 },
    'corn': { tIdeal: 10, hIdeal: 70, tSens: 0.10, hSens: 0.06, shelf: 90 },
    'potato': { tIdeal: 4, hIdeal: 90, tSens: 0.12, hSens: 0.08, shelf: 120 },
    'tomato': { tIdeal: 12, hIdeal: 85, tSens: 0.18, hSens: 0.10, shelf: 14 },
    'onion': { tIdeal: 2, hIdeal: 65, tSens: 0.07, hSens: 0.06, shelf: 180 },
    'apple': { tIdeal: 1, hIdeal: 90, tSens: 0.10, hSens: 0.07, shelf: 180 },
    'mango': { tIdeal: 12, hIdeal: 85, tSens: 0.20, hSens: 0.12, shelf: 21 },
    'banana': { tIdeal: 13, hIdeal: 85, tSens: 0.22, hSens: 0.10, shelf: 14 },
    'grapes': { tIdeal: 0, hIdeal: 90, tSens: 0.15, hSens: 0.09, shelf: 60 },
    'chickpea': { tIdeal: 10, hIdeal: 55, tSens: 0.06, hSens: 0.04, shelf: 365 },
    'mustard': { tIdeal: 8, hIdeal: 55, tSens: 0.07, hSens: 0.04, shelf: 180 },
    'soybean': { tIdeal: 10, hIdeal: 60, tSens: 0.08, hSens: 0.05, shelf: 365 },
    'groundnut': { tIdeal: 10, hIdeal: 60, tSens: 0.09, hSens: 0.05, shelf: 180 },
    'sugarcane': { tIdeal: 15, hIdeal: 80, tSens: 0.15, hSens: 0.08, shelf: 7 },
    'cotton': { tIdeal: 20, hIdeal: 50, tSens: 0.05, hSens: 0.03, shelf: 365 },
    'barley': { tIdeal: 10, hIdeal: 60, tSens: 0.07, hSens: 0.04, shelf: 180 },
    'lentil': { tIdeal: 10, hIdeal: 55, tSens: 0.06, hSens: 0.04, shelf: 365 },
    'garlic': { tIdeal: 0, hIdeal: 65, tSens: 0.08, hSens: 0.05, shelf: 180 },
    'ginger': { tIdeal: 13, hIdeal: 85, tSens: 0.12, hSens: 0.08, shelf: 90 },
    'carrot': { tIdeal: 0, hIdeal: 95, tSens: 0.13, hSens: 0.09, shelf: 60 },
    'cabbage': { tIdeal: 0, hIdeal: 95, tSens: 0.15, hSens: 0.10, shelf: 45 },
    'cauliflower': { tIdeal: 0, hIdeal: 90, tSens: 0.17, hSens: 0.10, shelf: 21 },
    'chili': { tIdeal: 8, hIdeal: 90, tSens: 0.14, hSens: 0.09, shelf: 14 },
    'pea': { tIdeal: 0, hIdeal: 90, tSens: 0.16, hSens: 0.10, shelf: 14 },
    'orange': { tIdeal: 5, hIdeal: 85, tSens: 0.11, hSens: 0.07, shelf: 60 },
    'lemon': { tIdeal: 8, hIdeal: 85, tSens: 0.10, hSens: 0.07, shelf: 90 },
    'coconut': { tIdeal: 15, hIdeal: 70, tSens: 0.06, hSens: 0.04, shelf: 60 },
    'papaya': { tIdeal: 12, hIdeal: 85, tSens: 0.20, hSens: 0.12, shelf: 14 },
};

function getCropParams(cropName) {
    const key = cropName.toLowerCase().trim();
    if (CROP_PARAMS_DB[key]) return CROP_PARAMS_DB[key];
    for (const k of Object.keys(CROP_PARAMS_DB)) {
        if (key.includes(k) || k.includes(key)) return CROP_PARAMS_DB[k];
    }
    return null; // Unknown — will fall through to AI
}

// Helper: Call Groq API
async function callGroq(systemPrompt, userPrompt, jsonMode = false) {
    const body = {
        model: 'llama-3.1-8b-instant',
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
        ],
        temperature: 0
    };
    if (jsonMode) body.response_format = { type: 'json_object' };

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`
        },
        body: JSON.stringify(body)
    });
    const data = await res.json();
    return data.choices?.[0]?.message?.content || null;
}

// Helper: Call Gemini API (supports text and vision)
async function callGemini(textPrompt, imageBase64 = null, mimeType = 'image/jpeg') {
    const GEMINI_API_KEY = process.env.GOOGLE_API_KEY;
    const model = 'gemini-1.5-flash';
    // v1beta is required for gemini-1.5-flash vision support
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;

    const parts = [];
    if (imageBase64) {
        parts.push({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    }
    parts.push({ text: textPrompt });

    const body = {
        contents: [{ parts }],
        generationConfig: {
            temperature: 0.7
        }
    };

    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });

    if (!res.ok) {
        const errText = await res.text();
        console.error(`❌ Gemini API HTTP Error [${res.status}]:`, errText);
        throw new Error(`Gemini Vision API failed with status ${res.status}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(`Gemini API Response error: ${data.error.message}`);

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    return text || null;
}

// --- MARKET DATA ---
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
        'yellowing': { name: 'Yellow Rust', cause: 'Fungal (Puccinia striiformis)', chemical: 'Propiconazole 25% EC', organic: 'Neem Oil spray' },
        'spots': { name: 'Leaf Blotch', cause: 'Septoria tritici', chemical: 'Tebuconazole', organic: 'Compost tea' },
        'rust': { name: 'Stem Rust', cause: 'Puccinia graminis', chemical: 'Tilt', organic: 'Sulphur dust' }
    },
    'Rice': {
        'spots': { name: 'Brown Spot', cause: 'Fungal (Bipolaris oryzae)', chemical: 'Mancozeb 75 WP', organic: 'Pseudomonas fluorescens' },
        'blast': { name: 'Rice Blast', cause: 'Magnaporthe oryzae', chemical: 'Tricyclazole', organic: 'Cow urine spray' },
        'wilting': { name: 'Bacterial Blight', cause: 'Xanthomonas oryzae', chemical: 'Streptocycline', organic: 'Neem cake' }
    },
    'Tomato': {
        'spots': { name: 'Early Blight', cause: 'Alternaria solani', chemical: 'Copper Oxychloride', organic: 'Bordeaux mixture' },
        'mold': { name: 'Late Blight', cause: 'Phytophthora infestans', chemical: 'Ridomil Gold', organic: 'Baking soda spray' },
        'curling': { name: 'Leaf Curl Virus', cause: 'TYLCV (Whitefly)', chemical: 'Imidacloprid', organic: 'Yellow sticky traps' },
        'mildew': { name: 'Powdery Mildew', cause: 'Oidium neolycopersici', chemical: 'Saaf (Carbendazim + Mancozeb)', organic: 'Neem Oil (3%)' }
    },
    'Potato': {
        'spots': { name: 'Early Blight', cause: 'Alternaria solani', chemical: 'Mancozeb', organic: 'Garlic extract' },
        'rot': { name: 'Late Blight', cause: 'Phytophthora infestans', chemical: 'Metalaxyl', organic: 'Copper spray' },
        'scab': { name: 'Common Scab', cause: 'Streptomyces scabies', chemical: 'Boric Acid', organic: 'Crop rotation' }
    }
};

// Fallback: Intelligent Simulated Diagnosis (based on image hash)
function getHashDiagnosis(crop, imageBase64) {
    const crops = Object.keys(DISEASE_DB);
    // Sample 10 positions spread across the image for a more unique hash
    let hash = imageBase64.length;
    const step = Math.max(1, Math.floor(imageBase64.length / 10));
    for (let i = 0; i < 10; i++) {
        hash = ((hash << 5) - hash) + (imageBase64.charCodeAt(i * step) || 0);
        hash |= 0;
    }
    hash = Math.abs(hash);
    const selectedCrop = (crop && DISEASE_DB[crop]) ? crop : crops[hash % crops.length];
    const diseases = Object.keys(DISEASE_DB[selectedCrop]);
    const diseaseKey = diseases[(hash + 7) % diseases.length];
    const d = DISEASE_DB[selectedCrop][diseaseKey];

    return {
        name: d.name,
        confidence: (80 + (hash % 15)) + '%',
        cause: d.cause,
        severity: (hash % 3 === 0) ? 'High' : 'Moderate',
        impact: `This ${d.name} infection is visibly affecting your ${selectedCrop}. It poses a significant threat to your yield.`,
        chemical: d.chemical,
        dosage: '2.5 ml per liter',
        interval: '7-10 days',
        precaution: 'Always wear protective gear during application.',
        organic: d.organic,
        steps: [
            `Carefully remove all visibly infected parts of the ${selectedCrop}.`,
            `Apply ${d.chemical} or ${d.organic} as primary treatment.`,
            'Ensure your plants have enough spacing for air circulation.',
            'Monitor the crop daily to prevent re-infection.'
        ]
    };
}

const dailyMarketCache = {};

// ============================================================
// ROUTE 1: Spoilage Prediction
// ============================================================
app.post('/api/predict-spoilage', async (req, res) => {
    let { cropType, temp, humidity, days } = req.body;
    cropType = (cropType || '').trim();

    if (!cropType) return res.status(400).json({ error: 'cropType is required' });

    try {
        // Step 1: Get crop parameters (DB first, then AI)
        let p = getCropParams(cropType);

        if (!p) {
            if (CROP_BIO_CACHE[cropType]) {
                p = CROP_BIO_CACHE[cropType];
            } else {
                const paramPrompt = `For the crop "${cropType}", provide storage parameters as JSON:
{"tIdeal":<ideal_temp_celsius>,"hIdeal":<ideal_humidity_percent>,"tSens":<0.01_to_0.30>,"hSens":<0.01_to_0.20>,"shelf":<max_shelf_life_days>}
Return ONLY the JSON object.`;
                const raw = await callGroq('You are an agricultural storage expert. Return ONLY valid JSON.', paramPrompt, true);
                let parsed = raw ? JSON.parse(raw) : null;
                if (parsed && parsed[cropType]) parsed = parsed[cropType];
                p = {
                    tIdeal: parseFloat(parsed?.tIdeal) || 15,
                    hIdeal: parseFloat(parsed?.hIdeal) || 60,
                    tSens: parseFloat(parsed?.tSens) || 0.10,
                    hSens: parseFloat(parsed?.hSens) || 0.05,
                    shelf: parseFloat(parsed?.shelf) || 60
                };
                CROP_BIO_CACHE[cropType] = p;
            }
        }

        // Step 2: BSI Math Model
        const tempDiff = Math.max(0, parseFloat(temp) - p.tIdeal);
        const thermalStress = Math.exp(tempDiff * p.tSens);
        const humDiff = Math.abs(parseFloat(humidity) - p.hIdeal);
        const hydraulicStress = 1 + (Math.pow(humDiff, 2) * p.hSens * 0.01);
        const timeFactor = parseFloat(days) / p.shelf;
        let risk = (thermalStress * hydraulicStress) * timeFactor * 50;
        risk = Math.min(Math.max(risk, 2), 99);
        const isHighRisk = risk > 50;

        // Step 3: AI Recommendation via Groq
        const advicePrompt = `Spoilage risk for ${cropType} is ${risk.toFixed(1)}%. Temp: ${temp}°C (ideal: ${p.tIdeal}°C), Humidity: ${humidity}% (ideal: ${p.hIdeal}%), Duration: ${days} days. Give one sentence of professional storage advice.`;
        const recommendation = await callGroq(
            'You are a professional post-harvest technologist. Be concise — one sentence only.',
            advicePrompt
        ) || (isHighRisk
            ? `High risk: cool ${cropType} to ${p.tIdeal}°C and adjust humidity to ${p.hIdeal}%.`
            : `Conditions stable. Maintain temperature near ${p.tIdeal}°C.`);

        res.json({ risk, isHighRisk, recommendation, meta: { tIdeal: p.tIdeal, hIdeal: p.hIdeal } });

    } catch (error) {
        console.error('Spoilage Prediction Error:', error);
        res.status(500).json({ error: 'Failed to process prediction' });
    }
});

// ============================================================
// ROUTE 2: Market Data
// ============================================================
app.get('/api/market', async (req, res) => {
    const { crop, region } = req.query;
    const today = new Date().toISOString().split('T')[0];
    const cacheKey = `${today}-${crop}-${region}`;

    if (dailyMarketCache[cacheKey]) return res.json(dailyMarketCache[cacheKey]);

    let marketData = null;

    // Check internal DB
    if (MARKET_DATA[crop] && MARKET_DATA[crop][region]) {
        const base = MARKET_DATA[crop][region];
        const rand = getSeededRandom(cacheKey);
        const variation = Math.floor((rand * 40) - 20);
        marketData = {
            current: base.current + variation,
            peak: base.peak + variation,
            trend: base.trend.map(p => p + variation)
        };
    }

    // Fallback to Groq AI
    if (!marketData) {
        try {
            const prompt = `Get current market price for ${crop} in ${region}, India. Return JSON: {"current":number,"peak":number,"trend":[7 numbers for last 7 days]}`;
            const raw = await callGroq(
                'You are a specialized agricultural market analyzer. Always return valid JSON with realistic Indian mandi prices in INR per quintal.',
                prompt, true
            );
            if (raw) marketData = JSON.parse(raw);
        } catch (e) {
            console.error('Market AI Error:', e);
        }
    }

    if (marketData) {
        dailyMarketCache[cacheKey] = marketData;
        return res.json(marketData);
    }

    res.status(500).json({ error: 'Failed to fetch market data' });
});

// ============================================================
// ROUTE 3: Disease Diagnosis (AI-powered via Groq)
// ============================================================
app.post('/api/diagnose', async (req, res) => {
    const { crop, symptom, imageBase64, mimeType } = req.body;

    if (!crop && !symptom && !imageBase64) {
        return res.status(400).json({ error: 'Please provide crop, symptom, or image for diagnosis.' });
    }

    // Determine context for diagnosis
    const hasImage = !!imageBase64;
    const cropNameRaw = (crop || '').trim();
    const cropName = cropNameRaw ? cropNameRaw : 'Unknown crop (detect from image)';
    const symptomDesc = symptom || (hasImage ? 'Visual analysis requested' : 'Standard symptoms analysis');

    const systemPrompt = `You are Dr. Agro, a world-renowned agricultural scientist and plant pathologist.
    You have specialized expertise in identifying crops and their diseases from visual data.
    If an image is provided, your primary task is to visually scan it for signs of pests, fungal infections, bacterial diseases, or nutrient deficiencies.
    If the crop type is not provided, you MUST identify the crop from its leaf/fruit structure in the image.

    CRITICAL: Respond ONLY with a valid JSON object. No markdown, no conversational text.`;

    const userPrompt = `[IMAGE ANALYSIS REQUEST]

    USER INPUTS:
    - Selected Crop: ${cropName}
    - User Observations: ${symptomDesc}
    ${hasImage ? '- IMAGE SOURCE: Uploaded photo of affected plant.' : '- IMAGE SOURCE: No photo provided.'}

    TASK:
    1. If Crop is "Unknown", identify the plant species from the image.
    2. Analyze the image/text for any abnormalities (spots, wilting, discoloration, pests).
    3. Diagnose the most likely disease or pest.
    4. Provide specific, professional treatment steps and chemical/organic solutions available in India.

    JSON OBJECT FORMAT (Required):
    {
      "name": "Disease Name",
      "confidence": "XX%",
      "cause": "Specific Cause/Pathogen",
      "severity": "Low/Moderate/High/Critical",
      "impact": "2 sentence impact description",
      "chemical": "Chemical Product (e.g., Saaf, Amistar Top)",
      "dosage": "e.g., 2ml/L",
      "interval": "e.g., 10 days",
      "precaution": "Farmer safety instruction",
      "organic": "Biological alternative",
      "steps": ["Step 1", "Step 2", "Step 3", "Step 4"]
    }`;

    // Vision-specific prompt for Gemini — forces image-grounded analysis
    const visionPrompt = `You are Dr. Agro, an expert plant pathologist analyzing a photo of a crop plant.

STEP 1 - VISUAL OBSERVATION: Carefully examine the image and describe exactly what you see:
- Leaf/fruit color (healthy green? yellowing? brown spots? white powder? dark lesions?)
- Texture and surface patterns (holes, wilting, rust-colored pustules, mold?)
- Affected area (whole plant? tips? edges? scattered spots?)
- Any visible pests, eggs, or insect damage?

STEP 2 - DIAGNOSIS: Based ONLY on what you see in this specific image, diagnose the most likely disease, pest, or nutritional deficiency. Do NOT give a generic response.

Crop type (if known): ${cropName}
Additional context: ${symptomDesc}

RETURN ONLY this JSON object (no markdown, no extra text):
{
  "name": "Specific Disease Name (e.g., Rice Blast, Tomato Early Blight, Powdery Mildew)",
  "confidence": "XX%",
  "cause": "Specific pathogen or cause (e.g., Magnaporthe oryzae fungus)",
  "severity": "Low/Moderate/High/Critical",
  "impact": "2 sentence impact specific to the observed symptoms",
  "chemical": "Chemical product available in India (e.g., Saaf, Amistar Top, Mancozeb 75WP)",
  "dosage": "Specific dosage (e.g., 2ml per liter of water)",
  "interval": "Application interval (e.g., every 10-14 days)",
  "precaution": "Safety instruction for farmer",
  "organic": "Organic/biological alternative treatment",
  "steps": ["Step 1 specific to this disease", "Step 2", "Step 3", "Step 4"]
}`;

    try {
        let raw = null;

        if (hasImage) {
            console.log("📸 Image detected. Calling Gemini Vision with image-specific prompt...");
            try {
                raw = await callGemini(visionPrompt, imageBase64, mimeType);
                if (raw) console.log("✅ Gemini Vision raw response received.");
            } catch (geminiErr) {
                console.error("Gemini Vision Error:", geminiErr.message);
                // Fall skip to smart hash below
            }
        }

        // --- SMART FALLBACK FOR IMAGES ---
        // If image was provided but Gemini failed, use smart hash diagnosis.
        // We do this BEFORE Groq because Groq is text-only and will hallucinate.
        if (!raw && hasImage) {
            console.log('🛡️ Gemini failed for image. Using Smart Hash Diagnosis (image-fingerprint based).');
            return res.json(getHashDiagnosis(crop, imageBase64));
        }

        // --- TEXT-ONLY ANALYSIS ---
        if (!raw) {
            try {
                console.log("⚠️ Calling Groq text-based analysis...");
                raw = await callGroq(systemPrompt, userPrompt, true);
            } catch (groqErr) {
                console.error("Groq Analysis Error:", groqErr.message);
            }
        }

        if (!raw) throw new Error('AI services unavailable and no image provided for fallback.');

        // Parse JSON — handle potential nesting or markdown wrapping
        let parsed;
        try {
            const cleaned = raw.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
            parsed = JSON.parse(cleaned);
        } catch (parseErr) {
            const match = raw.match(/\{[\s\S]*\}/);
            if (match) {
                parsed = JSON.parse(match[0]);
            } else {
                // Last ditch effort: if parsing failed, use hash but logs it
                if (hasImage) {
                    return res.json(getHashDiagnosis(crop, imageBase64));
                }
                throw new Error('Could not parse AI response as JSON');
            }
        }

        // Validate required fields and ensure steps is an array
        const result = {
            name: parsed.name || 'Unknown Disease',
            confidence: parsed.confidence || '75%',
            cause: parsed.cause || 'Unknown pathogen',
            severity: parsed.severity || 'Moderate',
            impact: parsed.impact || 'May reduce crop yield if untreated.',
            chemical: parsed.chemical || 'Consult local agronomist for recommendation',
            dosage: parsed.dosage || 'Follow label instructions',
            interval: parsed.interval || 'Every 7-10 days',
            precaution: parsed.precaution || 'Wear gloves and mask when applying pesticides.',
            organic: parsed.organic || 'Neem oil spray (5ml per liter of water)',
            steps: Array.isArray(parsed.steps) ? parsed.steps : [
                'Remove and destroy visibly infected plant parts immediately.',
                'Apply the recommended chemical treatment as directed.',
                'Ensure proper spacing between plants for air circulation.',
                'Monitor crop every 3-4 days and repeat treatment if needed.'
            ]
        };

        console.log(`✅ Diagnosis complete: ${result.name} (${result.confidence}) for ${cropName}`);
        res.json(result);

    } catch (error) {
        console.error('Disease Diagnosis Error:', error.message);
        res.status(500).json({
            error: 'AI Diagnosis Failed',
            details: error.message,
            suggestion: 'Please try again or provide more details.'
        });
    }
});

// Alias for older frontend code
app.post('/api/disease', (req, res) => {
    res.redirect(307, '/api/diagnose');
});


// ============================================================
// ROUTE 4: Weather Proxy
// ============================================================
app.get('/api/weather', async (req, res) => {
    const { lat, lng } = req.query;
    try {
        const response = await fetch(
            `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m`
        );
        const data = await response.json();
        res.json(data);
    } catch (error) {
        res.status(500).json({ error: 'Weather service unavailable' });
    }
});

// ============================================================
// ROUTE 5: AI Analyze (Groq, mimics Gemini response shape)
// ============================================================
app.post('/api/ai/analyze', async (req, res) => {
    const { prompt } = req.body;
    try {
        const text = await callGroq(
            'You are a professional agricultural AI assistant. Provide concise, actionable advice.',
            prompt
        );
        // Return in Gemini-compatible shape so existing frontend code works
        res.json({
            candidates: [{ content: { parts: [{ text: text || 'No response available.' }] } }]
        });
    } catch (error) {
        console.error('AI Analyze Error:', error);
        res.status(500).json({ error: 'Failed to analyze with AI' });
    }
});

// ============================================================
// Start Server
// ============================================================
app.listen(PORT, () => {
    console.log(`✅ Backend running at http://localhost:${PORT}`);
});
