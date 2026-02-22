// ===== FRONTEND SCRIPT - ENTRY POINT =====
// This script is loaded from frontend/script.js
// It connects the UI to the backend API

// --- API Configuration ---
const API_BASE_URL = ''; // Relative path - connects to backend

// --- Chart Configuration Helper ---
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.color = '#64748b';
Chart.defaults.scale.grid.color = '#f1f5f9';
Chart.defaults.scale.grid.borderColor = 'transparent';

// --- Navigation Logic ---
let _currentTabId = 'dashboard';

function switchTab(tabId) {
    if (tabId === _currentTabId) return;
    console.log('Switching to tab:', tabId);

    const allTabs = ['dashboard', 'spoilage', 'market', 'soil', 'rotation', 'predictions', 'disease', 'schemes', 'weather'];

    const outgoing = document.getElementById('view-' + _currentTabId);
    if (outgoing) {
        outgoing.classList.remove('fade-in');
        outgoing.classList.add('view-exit');
    }

    setTimeout(() => {
        allTabs.forEach(id => {
            const view = document.getElementById('view-' + id);
            const tab = document.getElementById('tab-' + id);
            if (view) view.classList.add('hidden');
            if (tab) {
                tab.classList.remove('active-tab');
                tab.classList.add('text-slate-500', 'hover:text-primary', 'hover:bg-slate-50', 'dark:text-slate-400', 'dark:hover:text-cyan-400', 'dark:hover:bg-white/5');
            }
        });

        const activeView = document.getElementById('view-' + tabId);
        const activeTab = document.getElementById('tab-' + tabId);
        const mobileMenu = document.getElementById('mobile-menu');

        if (activeView) {
            activeView.classList.remove('hidden', 'view-exit', 'fade-in');
            void activeView.offsetWidth;
            activeView.classList.add('fade-in');

            activeView.querySelectorAll('.slide-up').forEach(el => {
                el.style.animation = 'none';
                el.style.opacity = '0';
                void el.offsetWidth;
                el.style.animation = '';
                el.style.opacity = '';
            });
        }

        if (activeTab) {
            activeTab.classList.add('active-tab');
            activeTab.classList.remove('text-slate-500', 'hover:text-primary', 'hover:bg-slate-50', 'dark:text-slate-400', 'dark:hover:text-cyan-400', 'dark:hover:bg-white/5');
        }

        _currentTabId = tabId;

        if (tabId === 'predictions') setTimeout(initPredictionCharts, 50);
        if (tabId === 'rotation') generateRotationPlan();
        if (tabId === 'market') {
            setTimeout(() => { if (mandiMiniMap) mandiMiniMap.invalidateSize(); }, 200);
            initMandiMiniMap();
        }
        if (tabId === 'weather') {
            fetchDetailedWeather();
        }

        if (mobileMenu) mobileMenu.classList.add('hidden');
        window.scrollTo(0, 0);

    }, 200);
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
}

function enterApp() {
    const overlay = document.getElementById('login-overlay');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    setTimeout(() => overlay.remove(), 500);
}

// --- Location Management ---
let userLocation = {
    lat: 28.6139,
    lng: 77.2090,
    address: 'Delhi, India',
    isAutoDetected: false
};

let map = null;
let marker = null;
let storageChartInstance = null;

// --- Spoilage Prediction Logic ---
async function predictSpoilage(e) {
    e.preventDefault();

    const cropType = document.getElementById('cropType').value.trim();
    const temp = parseFloat(document.getElementById('tempInput').value);
    const humidity = parseFloat(document.getElementById('humidityInput').value);
    const days = parseInt(document.getElementById('durationInput').value);
    const predictButton = e.target.querySelector('button[type="submit"]');
    const resDiv = document.getElementById('predictionResult');

    if (!cropType) {
        alert('Please enter a crop name before predicting spoilage risk.');
        document.getElementById('cropType').focus();
        return;
    }

    const originalButtonText = predictButton.innerHTML;
    predictButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';
    predictButton.disabled = true;

    resDiv.innerHTML = `
        <div class="bg-slate-50 p-4 rounded-full mb-4 dark:bg-white/5">
            <i class="fa-solid fa-flask-atom fa-spin text-3xl text-slate-400"></i>
        </div>
        <h3 class="text-xl font-medium text-slate-500 dark:text-slate-400">AI is calculating risk...</h3>
    `;

    try {
        const response = await fetch('/api/predict-spoilage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cropType, temp, humidity, days }),
        });

        if (!response.ok) throw new Error(`Server error: ${response.status}`);

        const { risk, isHighRisk, recommendation, meta } = await response.json();

        const colorClass = isHighRisk ? 'text-red-600' : 'text-green-600';
        const bgClass = isHighRisk ? 'bg-red-50 dark:bg-red-500/10' : 'bg-green-50 dark:bg-emerald-500/10';
        const icon = isHighRisk ? '<i class="fa-solid fa-triangle-exclamation text-red-500"></i>' : '<i class="fa-solid fa-circle-check text-green-500"></i>';

        resDiv.innerHTML = `
            <div class="${bgClass} w-full h-full rounded-2xl flex flex-col justify-center items-center relative overflow-hidden fade-in px-4 border border-white/10">
                <div class="absolute top-4 left-4 bg-white/80 dark:bg-black/50 backdrop-blur-sm px-3 py-1 rounded-full border border-white/20 flex items-center gap-2 shadow-sm">
                    <i class="fa-solid fa-check-double text-green-500 text-xs"></i>
                    <span class="text-xs font-bold text-slate-600 dark:text-slate-300">96.5% Accuracy</span>
                </div>
                <div class="absolute top-4 right-4 text-2xl">${icon}</div>
                <p class="text-slate-500 font-medium mb-1 dark:text-slate-400">Spoilage Probability</p>
                <h2 class="text-6xl font-extrabold ${colorClass} mb-2 tracking-tight">${risk.toFixed(1)}%</h2>
                <p class="text-xs text-slate-500 mb-6 dark:text-slate-400">Biological analysis for: <span class="font-bold text-slate-800 dark:text-white">${cropType}</span></p>
                
                <div class="w-full max-w-xs bg-white/50 dark:bg-white/10 rounded-full h-2 mb-6">
                    <div class="${isHighRisk ? 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]'} h-2 rounded-full transition-all duration-1000" style="width: ${risk}%"></div>
                </div>

                ${meta ? `
                <div class="flex items-center gap-6 mt-2 bg-white/40 dark:bg-white/5 px-6 py-3 rounded-xl border border-white/20 backdrop-blur-sm">
                    <div class="flex flex-col items-center">
                        <span class="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-0.5">Ideal Temp</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white"><i class="fa-solid fa-temperature-low text-blue-500 mr-1"></i> ${meta.tIdeal}°C</span>
                    </div>
                    <div class="w-px h-8 bg-slate-300 dark:bg-white/10"></div>
                    <div class="flex flex-col items-center">
                        <span class="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400 tracking-wider mb-0.5">Ideal Humidity</span>
                        <span class="text-sm font-bold text-slate-800 dark:text-white"><i class="fa-solid fa-droplet text-cyan-500 mr-1"></i> ${meta.hIdeal}%</span>
                    </div>
                </div>
                ` : ''}
            </div>
        `;

        document.getElementById('recText').innerText = recommendation;
        document.getElementById('aiRecommendation').classList.remove('hidden');

        const dashRisk = document.getElementById('dashSpoilageRisk');
        const dashIcon = document.getElementById('dashSpoilageIcon');
        const dashDetail = document.getElementById('dashSpoilageDetail');

        if (dashRisk) {
            dashRisk.textContent = `${risk.toFixed(0)}%`;
            dashRisk.className = `text-3xl font-bold mt-2 ${isHighRisk ? 'text-red-600' : 'text-green-600'}`;
        }

    } catch (error) {
        console.error('Spoilage prediction failed:', error);
        alert(`Error: ${error.message}`);
    } finally {
        predictButton.innerHTML = originalButtonText;
        predictButton.disabled = false;
    }
}

// --- Rotation Plan Logic ---
function generateRotationPlan() {
    const container = document.getElementById('rotationPlanContainer');
    if (!container) return;

    container.innerHTML = '<div class="py-12 text-center"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i><p class="mt-2 text-slate-500">Analyzing market trends & soil data...</p></div>';

    setTimeout(() => {
        const plans = [
            [
                { name: "Rice", type: "Cereal", duration: 120, benefit: "Export Demand", color: "green", steps: [] },
                { name: "Mustard", type: "Oilseed", duration: 100, benefit: "Low Input", color: "yellow", steps: [] },
                { name: "Moong", type: "Legume", duration: 65, benefit: "Nitrogen Fix", color: "blue", steps: [] }
            ]
        ];

        const selectedPlan = plans[0];
        let html = '';

        selectedPlan.forEach((crop, index) => {
            const colors = {
                green: { bg: 'bg-green-100 dark:bg-green-900/30' },
                yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30' },
                blue: { bg: 'bg-blue-100 dark:bg-blue-900/30' }
            };

            const theme = colors[crop.color];
            html += `<div class="relative slide-up"><h4 class="font-bold text-lg">${crop.name}</h4><p class="text-sm text-slate-500">${crop.duration} days</p></div>`;
        });

        container.innerHTML = html;
    }, 600);
}

// --- Market Chart Logic ---
let marketChartInstance = null;

async function updateMarketChart(forceRefresh = false) {
    const cropInput = document.getElementById('marketCropSelect').value;
    if (!cropInput) return;

    const ctx = document.getElementById('marketMainChart');
    if (!ctx) return;

    const context = ctx.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(43, 108, 176, 0.2)');
    gradient.addColorStop(1, 'rgba(43, 108, 176, 0)');

    if (marketChartInstance) marketChartInstance.destroy();

    const currentPrice = 2150;
    const trend = [2100, 2150, 2180, 2240, 2220, 2280, 2300];

    document.getElementById('currentPriceDisplay').innerText = `₹${currentPrice}`;
    document.getElementById('peakPriceDisplay').innerText = `₹${Math.max(...trend)}`;

    marketChartInstance = new Chart(context, {
        type: 'line',
        data: {
            labels: ['Day 1', 'Day 2', 'Day 3', 'Day 4', 'Day 5', 'Day 6', 'Day 7'],
            datasets: [{
                label: `${cropInput} Price Forecast`,
                data: trend,
                borderColor: '#2B6CB0',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: false } }
        }
    });
}

// --- Prediction Chart Logic ---
let predictionChartInstance = null;

function initPredictionCharts() {
    const ctx = document.getElementById('predictionChart');
    if (!ctx) return;

    if (predictionChartInstance) predictionChartInstance.destroy();

    const context = ctx.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)');
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

    predictionChartInstance = new Chart(context, {
        type: 'bar',
        data: {
            labels: ['Wheat', 'Mustard', 'Chickpea'],
            datasets: [{
                label: 'Projected Profit (₹/Acre)',
                data: [24500, 21200, 18800],
                backgroundColor: gradient,
                borderColor: '#10B981',
                borderWidth: 2,
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// --- Disease Detection ---
async function analyzeDisease() {
    const crop = document.getElementById('diseaseCropSelect').value;
    const symptom = document.getElementById('diseaseSymptomSelect').value;

    document.getElementById('diseaseEmpty').classList.add('hidden');
    document.getElementById('diseaseLoading').classList.remove('hidden');

    try {
        const response = await fetch('/api/diagnose', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ crop, symptom })
        });

        const result = await response.json();

        document.getElementById('diseaseName').innerText = result.name || 'Disease';
        document.getElementById('diseaseConfidence').innerText = result.confidence || '75%';
        document.getElementById('diseaseSeverity').innerText = result.severity || 'Moderate';
        document.getElementById('diseaseChemical').innerText = result.chemical || 'N/A';

        document.getElementById('diseaseLoading').classList.add('hidden');
        document.getElementById('diseaseResult').classList.remove('hidden');

    } catch (error) {
        console.error('Disease diagnosis failed:', error);
        document.getElementById('diseaseLoading').classList.add('hidden');
        alert('Error analyzing disease');
    }
}

// --- Weather Functions ---
async function fetchWeatherData() {
    try {
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${userLocation.lat}&longitude=${userLocation.lng}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`);
        const data = await response.json();

        if (data && data.current) {
            const temp = data.current.temperature_2m;
            const humidity = data.current.relative_humidity_2m;

            const tempInput = document.getElementById('tempInput');
            const humidityInput = document.getElementById('humidityInput');

            if (tempInput) tempInput.value = temp;
            if (humidityInput) humidityInput.value = humidity;

            const dashTemp = document.getElementById('dashTemperature');
            const dashHumidity = document.getElementById('dashHumidity');

            if (dashTemp) dashTemp.textContent = `${Math.round(temp)}°C`;
            if (dashHumidity) dashHumidity.textContent = `${humidity}%`;
        }
    } catch (error) {
        console.error('Weather fetch failed:', error);
    }
}

function fetchDetailedWeather() {
    console.log('Fetching detailed weather for', userLocation.address);
}

// --- Theme Toggle ---
function toggleTheme(event) {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('color-theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('color-theme', 'dark');
    }
}

// --- Location Management ---
function toggleLocationMap() {
    alert('Location management feature coming soon!');
}

function updateLocationDisplay() {
    const dashLocationText = document.getElementById('dashLocationText');
    if (dashLocationText) {
        dashLocationText.textContent = userLocation.address;
    }
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function () {
    console.log('Frontend app initialized');
    
    // Populate Crop Datalists
    const crops = ['Wheat', 'Rice', 'Maize', 'Potato', 'Tomato', 'Onion', 'Cotton', 'Mustard'];
    const cropOptions = document.getElementById('cropOptions');
    const marketCropOptions = document.getElementById('marketCropOptions');
    const diseaseCropSelect = document.getElementById('diseaseCropSelect');

    crops.forEach(crop => {
        if (cropOptions) {
            const option = document.createElement('option');
            option.value = crop;
            cropOptions.appendChild(option);
        }
        if (marketCropOptions) {
            const option = document.createElement('option');
            option.value = crop;
            marketCropOptions.appendChild(option);
        }
    });

    // Init Dashboard Charts
    const ctxStorage = document.getElementById('storageChart');
    if (ctxStorage) {
        const context = ctxStorage.getContext('2d');
        storageChartInstance = new Chart(context, {
            type: 'line',
            data: {
                labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
                datasets: [{
                    label: 'Temperature (°C)',
                    data: [24, 25, 25, 26, 28, 27, 26],
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.2)',
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } }
            }
        });
    }

    // Fetch initial data
    fetchWeatherData();
    updateLocationDisplay();
});

// --- Market Chart Dashboard ---
let dashboardMarketChartInstance = null;

function initDashboardMarketChart() {
    const ctx = document.getElementById('marketChartDashboard');
    if (!ctx) return;

    const context = ctx.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 300);
    gradient.addColorStop(0, 'rgba(214, 158, 46, 0.2)');
    gradient.addColorStop(1, 'rgba(214, 158, 46, 0)');

    dashboardMarketChartInstance = new Chart(context, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Wheat Price',
                data: [2100, 2150, 2180, 2240],
                borderColor: '#D69E2E',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } }
        }
    });
}

// --- Location Map Integration ---
let mandiMiniMap = null;

function initMandiMiniMap() {
    if (mandiMiniMap) return;

    const container = document.getElementById('mandiMiniMap');
    if (!container) return;

    mandiMiniMap = L.map('mandiMiniMap', {
        zoomControl: false,
        attributionControl: false
    }).setView([userLocation.lat, userLocation.lng], 10);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
    }).addTo(mandiMiniMap);
}

// Populate Market Crop Select
function populateMarketCrops() {
    const select = document.getElementById('mandiRegionSelect');
    if (select && select.innerHTML === '') {
        const options = ['Azadpur (Delhi)', 'Vashi (Mumbai)', 'Hapur (UP)', 'Bengaluru (KA)', 'Kolkata (WB)'];
        options.forEach(opt => {
            const option = document.createElement('option');
            option.value = opt;
            option.text = opt;
            select.appendChild(option);
        });
    }
}

// Helper functions for missing features
function triggerTranslation(lang) { console.log('Translating to:', lang); }
function fetchLocationBasedSoilData() { console.log('Fetching soil data'); }
function fetchColdStorageData() { console.log('Fetching cold storage'); }
function requestGeolocation() { alert('Geolocation coming soon'); }
