# KrishiDrishti AI - Frontend

## Overview
The frontend is a single-page application (SPA) built with vanilla JavaScript, Tailwind CSS, and CDN-based libraries. It provides a comprehensive agricultural intelligence dashboard with real-time data integration.

## File Structure

```
frontend/
├── index.html         # Main HTML entry point (4400+ lines)
├── script.js          # JavaScript orchestration logic (2200+ lines)
├── styles.css         # Global styling and animations (230 lines)
└── README.md          # This file
```

## Key Components

### 1. **index.html** - UI Framework
- **Tailwind CSS Configuration**: Custom theme with primary (#2F855A), secondary (#2B6CB0), accent (#D69E2E)
- **Dark Mode Support**: Full dark theme implementation with CSS variables
- **9 Main Sections**:
  - Dashboard - Farm overview with AI recommendations
  - Spoilage Risk - Storage condition analysis
  - Market Intelligence - Price forecasting and mandi data
  - Soil Health - Nitrogen, pH, organic carbon tracking
  - Crop Rotation - Multi-season planning
  - Disease Detection - Symptom analyzer with AI diagnosis
  - Weather - Detailed forecast and conditions
  - Government Schemes - Available subsidies and benefits
  - Predictions & Analysis - Profitability comparisons

- **External Libraries** (via CDN):
  - **Tailwind CSS**: Responsive utility-first CSS framework
  - **Chart.js 3.x**: Data visualization (line, bar, area charts)
  - **Leaflet.js 1.9.4**: Interactive map integration
  - **FontAwesome 6.4.0**: Icon system (650+ icons)
  - **Google Translate**: Multi-language support (11 languages)

### 2. **script.js** - Application Logic
- **Navigation System**: Tab switching with smooth transitions
- **API Integration**:
  - `/api/predict-spoilage` - Risk prediction
  - `/api/diagnose` - Disease identification
  - Open-Meteo API - Weather data (free, no key)
  - SoilGrids API - Soil analysis (free, no key)
  - Nominatim API - Location geocoding (free, no key)

- **Key Functions**:
  - `switchTab(tabId)` - Navigate between sections
  - `predictSpoilage(e)` - Send crop data to backend for analysis
  - `analyzeDisease()` - Diagnose plant disease
  - `updateMarketChart()` - Fetch and display price trends
  - `fetchWeatherData()` - Get current conditions
  - `toggleTheme()` - Dark/light mode
  - `generateRotationPlan()` - Display crop rotation advice
  - `initPredictionCharts()` - Render profitability charts

- **Data Structure**:
  ```javascript
  userLocation = {
    lat: 28.6139,
    lng: 77.2090,
    address: 'Delhi, India',
    isAutoDetected: false
  };
  ```

### 3. **styles.css** - Visual Styling
- **Animations**:
  - `fadeIn` (0.6s) - Smooth opacity and translate entrance
  - `bgDrift` (30s) - Subtle background movement
  - `slideUp` (0.4s) - Card entrance animation
  - `pulse-ring` - Location marker pulse effect

- **Glass Morphism**: Frosted glass panels with backdrop blur
- **Scrollbar**: Custom webkit styling with dark mode support
- **Active Tab Indicator**: Green underline for current navigation
- **Responsive Design**: Mobile-first approach with Tailwind breakpoints

## API Endpoints

All endpoints are relative to the backend base URL:

| Endpoint | Method | Purpose | Body |
|----------|--------|---------|------|
| `/api/predict-spoilage` | POST | Risk analysis | `{cropType, temp, humidity, days}` |
| `/api/diagnose` | POST | Disease detection | `{crop, symptom}` or base64 image |
| `/api/market` | GET | Price data | Query params: `crop`, `region` |
| `/api/weather` | GET | Weather forecast | Query params: `lat`, `lng` |

## External API Dependencies

### Free APIs (No Key Required)
- **Open-Meteo**: Weather and climate data
- **Nominatim**: Location search and geocoding
- **SoilGrids**: Soil properties (NASA/ISRIC)
- **OSRM**: Route optimization

### Optional Services
- **Google Translate**: Multi-language UI (script tag insert)

## Theme System

### Color Palette
```css
primary:   #2F855A (Emerald Green)
secondary: #2B6CB0 (Ocean Blue)
accent:    #D69E2E (Warm Yellow)
danger:    #C53030 (Alert Red)
```

### Dark Mode
- Activated via `dark` class on `<html>` element
- Stored in localStorage as `color-theme`
- All components have dark: variants in Tailwind

## Usage

### Local Development
1. Ensure backend server is running on same or configured port
2. Open `index.html` in a modern browser
3. Login button triggers `enterApp()` which removes overlay
4. Use navigation tabs to explore features

### Required Backend Services
- At least one endpoint responding to `/api/predict-spoilage`
- Preferably all endpoints for full functionality
- CORS headers should allow requests from frontend origin

### Mobile Responsiveness
- Mobile menu accessible via hamburger button (md breakpoint)
- Touch-optimized buttons and inputs (44px+ height)
- Responsive grid layouts (1 col mobile → 4 cols desktop)

## Performance Optimization

- **Chart Instances**: Managed globally to prevent memory leaks
- **Event Delegation**: Tab switching uses single listener
- **CSS Transforms**: Hardware acceleration via `translateY`, `scale`
- **Lazy Loading**: Charts initialized only when tab accessed
- **Local Storage**: Theme preference persists across sessions

## Browser Compatibility

- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+
- Mobile browsers with viewport meta support

## Future Enhancements

- [ ] WebWorker for heavy computations
- [ ] Service Worker for offline mode
- [ ] Image upload preview for disease detection
- [ ] Real-time WebSocket updates
- [ ] PWA capabilities (app install)
- [ ] Accessibility (WCAG 2.1 AA)
- [ ] Performance metrics (Web Vitals)

## Troubleshooting

**Charts not rendering**: Call `updateChartsTheme()` after theme toggle
**Location not updating**: Verify Nominatim API is accessible
**Weather data missing**: Check Open-Meteo API response format
**Translations not working**: Ensure Google Translate script loads

---

**Last Updated**: 2024  
**Maintained by**: KrishiDrishti Development Team
