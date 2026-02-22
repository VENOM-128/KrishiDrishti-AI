# KrishiDrishti AI - Intelligent Agriculture Platform

A modern, AI-powered agricultural advisory system that helps farmers with:
- 🌾 **Spoilage Prediction** - Real-time crop storage risk assessment
- 🏪 **Market Intelligence** - Live market prices and trends
- 🦠 **Disease Diagnosis** - AI-powered crop disease identification with treatment recommendations
- 🌤️ **Weather Integration** - Real-time weather data
- 🧠 **AI Advisory** - Smart agricultural recommendations

## Project Structure

```
Hacnovation2.0/
├── frontend/                 # Frontend application
│   ├── index.html           # Main HTML file
│   ├── script.js            # Frontend logic & API calls
│   └── styles.css           # Styling
│
├── backend/                 # Backend server
│   ├── server.js            # Main Express server
│   ├── package.json         # Dependencies
│   ├── .env.example         # Environment variables template
│   ├── .gitignore           # Git ignore rules
│   │
│   ├── src/
│   │   ├── routes/          # API route handlers
│   │   │   └── apiRoutes.js # Main API endpoints
│   │   │
│   │   ├── logic/           # Business logic layer
│   │   │   ├── spoilageLogic.js      # Spoilage prediction
│   │   │   ├── diseaseLogic.js       # Disease diagnosis
│   │   │   └── marketLogic.js        # Market data fetching
│   │   │
│   │   ├── models/          # Data models
│   │   │   └── cropDatabase.js       # Crop parameters & disease data
│   │   │
│   │   └── utils/           # Utility functions
│   │       └── aiService.js # AI API calls (Groq, Gemini)
│   │
│   └── tests/               # Test files
│       ├── list-groq-models.js
│       └── test-gemini-final.js
│
└── README.md                # This file
```

## Technology Stack

- **Frontend:**
  - HTML5, CSS3, Tailwind CSS
  - Vanilla JavaScript
  - Chart.js for visualizations
  - Leaflet.js for maps

- **Backend:**
  - Node.js + Express.js
  - Groq API (LLaMA 3.1 for reasoning)
  - Google Gemini API (vision & language)
  - Open-Meteo API (weather)
  - CORS enabled for frontend integration

## Installation

### Prerequisites
- Node.js 14+
- npm or yarn
- Groq API Key (https://console.groq.com/keys)
- Google Gemini API Key (https://aistudio.google.com/app/apikey)

### Backend Setup

```bash
cd backend

# Install dependencies
npm install

# Create .env file
cp .env.example .env

# Add your API keys to .env
# GROQ_API_KEY=your_key_here
# GOOGLE_API_KEY=your_key_here

# Start server
npm start              # Production
npm run dev            # Development (with nodemon)
```

### Frontend Setup

The frontend is served directly from the backend at `http://localhost:3000`

```bash
# Just access in browser
http://localhost:3000
```

## API Endpoints

### 1. Spoilage Prediction
```
POST /api/predict-spoilage
Content-Type: application/json

{
  "cropType": "wheat",
  "temp": 25,
  "humidity": 65,
  "days": 30
}

Response:
{
  "risk": 35.2,
  "isHighRisk": false,
  "recommendation": "...",
  "meta": { "tIdeal": 12, "hIdeal": 60 }
}
```

### 2. Market Data
```
GET /api/market?crop=Wheat&region=Azadpur%20(Delhi)

Response:
{
  "current": 2150,
  "peak": 2340,
  "trend": [2100, 2150, 2180, ...]
}
```

### 3. Disease Diagnosis
```
POST /api/diagnose
Content-Type: application/json

{
  "crop": "Rice",
  "symptom": "brown spots on leaves",
  "imageBase64": "...",  // Optional image
  "mimeType": "image/jpeg"
}

Response:
{
  "name": "Rice Blast",
  "confidence": "85%",
  "cause": "Magnaporthe oryzae",
  "severity": "High",
  "impact": "...",
  "chemical": "Tricyclazole",
  "dosage": "2ml/L",
  "interval": "10 days",
  "precaution": "...",
  "organic": "Cow urine spray",
  "steps": [...]
}
```

### 4. Weather
```
GET /api/weather?lat=28.7041&lng=77.1025

Response: (from Open-Meteo)
{
  "current": {
    "temperature_2m": 25.5,
    "relative_humidity_2m": 65
  }
}
```

### 5. AI Analysis
```
POST /api/ai/analyze
Content-Type: application/json

{
  "prompt": "How to increase wheat yield?"
}

Response:
{
  "candidates": [{
    "content": {
      "parts": [{ "text": "..." }]
    }
  }]
}
```

## Features

### Disease Diagnosis
- **Multi-source Analysis:**
  - Gemini Vision: Image-based disease detection
  - Groq AI: Text-based symptom analysis
  - Smart Hash Fallback: Deterministic diagnosis when AI fails

- **Treatment Recommendations:**
  - Chemical solutions (specific products available in India)
  - Organic alternatives
  - Dosage instructions
  - Application intervals
  - Safety precautions

### Spoilage Prediction
- **BSI Math Model:** Biological Stress Index calculation
- **Temperature & Humidity Analysis**
- **Shelf-life Estimation**
- **Storage Recommendations**

### Market Intelligence
- **Real-time Prices**
- **Price Trends**
- **Seeded Random:** Consistent daily variations
- **AI Fallback:** Groq-powered price estimation

## Configuration

### Environment Variables (.env)
```
# API Keys
GROQ_API_KEY=xxx
GOOGLE_API_KEY=xxx

# Server
PORT=3000
NODE_ENV=development
```

## Development

### Start Development Server
```bash
cd backend
npm run dev
```

This uses `nodemon` to auto-restart on file changes.

### File Organization
- **routes/**: API endpoint handlers
- **logic/**: Business logic & algorithms
- **models/**: Data structures & database constants
- **utils/**: Helper functions & API calls

## Contributing

1. Create a feature branch
2. Make changes
3. Test thoroughly
4. Create a pull request

## Commit Guidelines

- ✨ **Feature**: New functionality
- 🐛 **Bug**: Bug fixes
- 📦 **Refactor**: Code reorganization
- 🎨 **Style**: Formatting changes
- 📝 **Docs**: Documentation
- 🧪 **Test**: Testing additions

Example:
```bash
git commit -m "✨ feat: Add spoilage prediction API endpoint"
git commit -m "🐛 fix: Handle missing crop parameters"
git commit -m "📦 refactor: Reorganize disease logic module"
```

## Performance Notes

- **Caching:** Daily market cache to reduce API calls
- **Crop Bio Cache:** Store computed crop parameters
- **Lazy Loading:** AI models called on-demand
- **Image Optimization:** Up to 50MB request limit

## Future Enhancements

- [ ] Database integration (PostgreSQL)
- [ ] User authentication & profiles
- [ ] Historical data tracking
- [ ] Crop rotation recommendations
- [ ] Soil analysis integration
- [ ] Mobile app version
- [ ] SMS/WhatsApp notifications

## License

ISC

## Support

For issues and suggestions, please create an issue in the repository.

---

**Made with ❤️ for Indian Farmers**
