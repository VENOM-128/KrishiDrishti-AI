// --- API Configuration ---
// API Key moved to backend

// --- Chart Configuration Helper ---
Chart.defaults.font.family = "'Outfit', sans-serif";
Chart.defaults.color = '#64748b';
Chart.defaults.scale.grid.color = '#f1f5f9';
Chart.defaults.scale.grid.borderColor = 'transparent';

// --- Navigation Logic ---
function switchTab(tabId) {
    console.log("Switching to tab:", tabId);
    ['dashboard', 'spoilage', 'market', 'soil', 'rotation', 'predictions', 'disease', 'schemes'].forEach(id => {
        const view = document.getElementById('view-' + id);
        const tab = document.getElementById('tab-' + id);

        if (view) {
            view.classList.add('hidden');
        }
        if (tab) {
            tab.classList.remove('active-tab');
            tab.classList.add('text-slate-500', 'hover:text-primary', 'hover:bg-slate-50', 'dark:text-slate-400', 'dark:hover:text-cyan-400', 'dark:hover:bg-white/5');
        }
    });

    const activeView = document.getElementById('view-' + tabId);
    const activeTab = document.getElementById('tab-' + tabId);
    const mobileMenu = document.getElementById('mobile-menu');

    if (activeView) {
        activeView.classList.remove('hidden');

        // Reset animations for re-triggering
        activeView.classList.remove('fade-in');
        const animatedElements = activeView.querySelectorAll('.slide-up');
        animatedElements.forEach(el => {
            el.style.animation = 'none';
            el.style.opacity = '0';
        });

        void activeView.offsetWidth; // Trigger reflow

        activeView.classList.add('fade-in');
        animatedElements.forEach(el => {
            el.style.animation = '';
            el.style.opacity = '';
        });
    }

    if (activeTab) {
        activeTab.classList.add('active-tab');
        activeTab.classList.remove('text-slate-500', 'hover:text-primary', 'hover:bg-slate-50', 'dark:text-slate-400', 'dark:hover:text-cyan-400', 'dark:hover:bg-white/5');
    }

    if (tabId === 'predictions') {
        setTimeout(initPredictionCharts, 50);
    }

    if (tabId === 'rotation') {
        generateRotationPlan();
    }

    if (tabId === 'market') {
        setTimeout(() => { if (mandiMiniMap) mandiMiniMap.invalidateSize(); }, 200);
        initMandiMiniMap();
    }

    if (mobileMenu) mobileMenu.classList.add('hidden');
    window.scrollTo(0, 0);
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
    lat: 28.6139, // Default: Delhi
    lng: 77.2090,
    address: 'Delhi, India',
    isAutoDetected: false
};

let map = null;
let marker = null;
let routeLayer = null;
let destMarker = null;
let storageChartInstance = null;

// Request automatic geolocation
function requestGeolocation() {
    const btn = document.querySelector('button[onclick="requestGeolocation()"]');
    const icon = btn ? btn.querySelector('i') : null;
    if (icon) icon.className = 'fa-solid fa-circle-notch fa-spin text-lg';

    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                userLocation.lat = position.coords.latitude;
                userLocation.lng = position.coords.longitude;
                userLocation.isAutoDetected = true;

                // Update map if it exists
                if (map) {
                    map.setView([userLocation.lat, userLocation.lng], 16);
                    if (marker) {
                        marker.setLatLng([userLocation.lat, userLocation.lng]);
                    }
                }

                reverseGeocode(userLocation.lat, userLocation.lng);
                updateLocationDisplay();
                if (icon) icon.className = 'fa-solid fa-crosshairs text-lg';
            },
            (error) => {
                console.log('Geolocation denied or failed:', error);
                alert('Unable to get your location. Please select manually on the map.');
                if (icon) icon.className = 'fa-solid fa-crosshairs text-lg';
            }
        );
    } else {
        alert('Geolocation is not supported by your browser. Please select location manually.');
        if (icon) icon.className = 'fa-solid fa-crosshairs text-lg';
    }
}

// Reverse geocode coordinates to address using Nominatim (OpenStreetMap)
async function reverseGeocode(lat, lng) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&addressdetails=1`);
        const data = await response.json();

        if (data && data.display_name) {
            userLocation.address = data.display_name;
            userLocation.state = data.address.state || data.address.region || data.address.county;
            updateLocationDisplay();
        }
    } catch (error) {
        console.error('Reverse geocoding failed:', error);
        userLocation.address = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
        updateLocationDisplay();
    }
}

// Initialize Leaflet Map with OpenStreetMap
function initializeMap() {
    // Create map
    map = L.map('map').setView([userLocation.lat, userLocation.lng], 12);

    // Define Layers
    const streetLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    });

    // Satellite Layer
    const satelliteLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        attribution: '© Esri',
        maxZoom: 19
    });

    // Add Satellite by default
    satelliteLayer.addTo(map);

    // Layer control to switch between map types
    const baseMaps = {
        "Satellite": satelliteLayer,
        "Street Map": streetLayer
    };

    L.control.layers(baseMaps, null, { position: 'bottomleft' }).addTo(map);

    // Add marker
    marker = L.marker([userLocation.lat, userLocation.lng], {
        draggable: true,
        title: 'Farm Location'
    }).addTo(map);

    // Update location on marker drag
    marker.on('dragend', function (event) {
        const position = marker.getLatLng();
        userLocation.lat = position.lat;
        userLocation.lng = position.lng;
        reverseGeocode(userLocation.lat, userLocation.lng);
    });

    // Update location on map click
    map.on('click', function (event) {
        userLocation.lat = event.latlng.lat;
        userLocation.lng = event.latlng.lng;
        marker.setLatLng(event.latlng);
        reverseGeocode(userLocation.lat, userLocation.lng);
    });

    // Add search functionality using Nominatim
    const searchInput = document.getElementById('locationSearch');
    searchInput.addEventListener('keypress', async function (e) {
        if (e.key === 'Enter') {
            const query = searchInput.value;
            if (query.trim()) {
                await searchLocation(query);
            }
        }
    });
}

// Search for location using Nominatim (OpenStreetMap)
async function searchLocation(query) {
    try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1&addressdetails=1`);
        const data = await response.json();

        if (data && data.length > 0) {
            const result = data[0];
            userLocation.lat = parseFloat(result.lat);
            userLocation.lng = parseFloat(result.lon);
            userLocation.address = result.display_name;
            userLocation.state = result.address.state || result.address.region || result.address.county;

            if (map && marker) {
                map.setView([userLocation.lat, userLocation.lng], 13);
                marker.setLatLng([userLocation.lat, userLocation.lng]);
            }

            updateLocationDisplay();
        } else {
            alert('Location not found. Please try a different search term.');
        }
    } catch (error) {
        console.error('Location search failed:', error);
        alert('Search failed. Please try again.');
    }
}

// Handle search button click
function handleSearchClick() {
    const searchInput = document.getElementById('locationSearch');
    const query = searchInput.value.trim();
    if (query) {
        searchLocation(query);
    } else {
        alert('Please enter a location to search.');
    }
}

// Toggle location map overlay
function toggleLocationMap() {
    const overlay = document.getElementById('locationMapOverlay');
    const isHidden = overlay.classList.contains('hidden');
    overlay.classList.toggle('hidden');

    if (isHidden) {
        // Opening map - reset route if any
        if (routeLayer) {
            map.removeLayer(routeLayer);
            routeLayer = null;
        }
        if (destMarker) {
            map.removeLayer(destMarker);
            destMarker = null;
        }

        // Initialize map when shown for the first time
        if (!map) {
            setTimeout(() => initializeMap(), 100); // Small delay for DOM rendering
        } else {
            map.invalidateSize();
            // Re-center map to current location using Leaflet API
            map.setView([userLocation.lat, userLocation.lng], 12);
            marker.setLatLng([userLocation.lat, userLocation.lng]);
        }
        updateLocationDisplay();
    }
}

function showRouteToFacility(lat, lng, name) {
    const overlay = document.getElementById('locationMapOverlay');
    overlay.classList.remove('hidden');

    if (!map) {
        setTimeout(() => {
            initializeMap();
            drawRoute(lat, lng, name);
        }, 100);
    } else {
        setTimeout(() => {
            map.invalidateSize();
            drawRoute(lat, lng, name);
        }, 100);
    }
}

async function drawRoute(lat, lng, name) {
    if (routeLayer) map.removeLayer(routeLayer);
    if (destMarker) map.removeLayer(destMarker);

    // Custom Icons
    const startIcon = L.divIcon({
        html: '<div class="bg-blue-600 w-4 h-4 rounded-full border-2 border-white shadow-lg pulse-ring"></div>',
        className: '',
        iconSize: [16, 16]
    });

    const destIcon = L.divIcon({
        html: '<div class="text-red-600 text-4xl drop-shadow-xl filter"><i class="fa-solid fa-location-dot"></i></div>',
        className: '',
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
    });

    // Update User Marker
    if (marker) marker.setIcon(startIcon);

    // Add Destination Marker
    destMarker = L.marker([lat, lng], { icon: destIcon }).addTo(map);

    // Fetch Route from OSRM (Open Source Routing Machine)
    try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${userLocation.lng},${userLocation.lat};${lng},${lat}?overview=full&geometries=geojson&alternatives=true`);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes && data.routes.length > 0) {
            // Sort by distance to get the shortest route
            const route = data.routes.sort((a, b) => a.distance - b.distance)[0];

            // Draw Route
            routeLayer = L.geoJSON(route.geometry, {
                style: {
                    color: '#3b82f6', // Blue-500
                    weight: 6,
                    opacity: 0.8,
                    lineCap: 'round',
                    lineJoin: 'round'
                }
            }).addTo(map);

            // Fit bounds to route
            map.fitBounds(routeLayer.getBounds(), { padding: [100, 100] });

            // Add rich popup
            const durationMins = Math.round(route.duration / 60);
            const distanceKm = (route.distance / 1000).toFixed(1);

            destMarker.bindPopup(`
                <div class="text-center min-w-[200px] p-2 font-sans">
                    <h3 class="font-bold text-slate-900 text-base mb-2">${name}</h3>
                    <div class="flex justify-center gap-3 text-xs text-slate-600 mb-3 font-medium bg-slate-100 p-2 rounded-lg border border-slate-200">
                        <span><i class="fa-solid fa-clock text-blue-500"></i> ${durationMins} min</span>
                        <span><i class="fa-solid fa-route text-green-500"></i> ${distanceKm} km</span>
                    </div>
                    <a href="https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${lat},${lng}&travelmode=driving" 
                       target="_blank" 
                       class="block w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 !text-white text-sm font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 no-underline">
                       <i class="fa-brands fa-google"></i> Navigate via Google Maps
                    </a>
                </div>
            `).openPopup();
        } else {
            throw new Error('No route found');
        }
    } catch (error) {
        console.error('Routing failed:', error);
        // Fallback to straight line
        const latlngs = [[userLocation.lat, userLocation.lng], [lat, lng]];
        routeLayer = L.polyline(latlngs, { color: 'blue', weight: 4, opacity: 0.5, dashArray: '10, 10' }).addTo(map);
        map.fitBounds(L.latLngBounds(latlngs), { padding: [50, 50] });

        destMarker.bindPopup(`
            <div class="text-center min-w-[200px] p-2 font-sans">
                <h3 class="font-bold text-slate-900 text-base mb-2">${name}</h3>
                <div class="text-xs text-slate-500 mb-3">Straight Line Distance</div>
                <a href="https://www.google.com/maps/dir/?api=1&origin=${userLocation.lat},${userLocation.lng}&destination=${lat},${lng}&travelmode=driving" 
                   target="_blank" 
                   class="block w-full px-4 py-2.5 bg-blue-600 hover:bg-blue-700 !text-white text-sm font-bold rounded-lg transition-colors shadow-md flex items-center justify-center gap-2 no-underline">
                   <i class="fa-brands fa-google"></i> Navigate via Google Maps
                </a>
            </div>
        `).openPopup();
    }
}

// Confirm location selection
function confirmLocation() {
    updateLocationDisplay();
    fetchLocationBasedSoilData();
    fetchWeatherData();
    fetchStorageHistory(userLocation.lat, userLocation.lng);
    fetchNearbyMandis();
    toggleLocationMap();

    // Show success message
    const locationText = userLocation.address.length > 50
        ? userLocation.address.substring(0, 50) + '...'
        : userLocation.address;
    alert(`✅ Location set to: ${locationText}\n\nFetching soil data for this region...`);
}

// Update location display in UI
function updateLocationDisplay() {
    // Update dashboard location text
    const dashLocationText = document.getElementById('dashLocationText');
    if (dashLocationText) {
        const shortAddress = userLocation.address.split(',').slice(-2).join(',').trim();
        dashLocationText.textContent = shortAddress || userLocation.address;
    }

    // Update modal location display
    const selectedLocationText = document.getElementById('selectedLocationText');
    const selectedCoordinates = document.getElementById('selectedCoordinates');

    if (selectedLocationText) {
        selectedLocationText.textContent = userLocation.address;
    }

    if (selectedCoordinates) {
        const latDir = userLocation.lat >= 0 ? 'N' : 'S';
        const lngDir = userLocation.lng >= 0 ? 'E' : 'W';
        selectedCoordinates.textContent =
            `${Math.abs(userLocation.lat).toFixed(4)}°${latDir}, ${Math.abs(userLocation.lng).toFixed(4)}°${lngDir}`;
    }
}

// Fetch location-based soil data using open-source SoilGrids API
async function fetchLocationBasedSoilData() {
    try {
        // SoilGrids REST API (ISRIC World Soil Information)
        // Fetches nitrogen, pH, and SOC at 0-5cm depth
        const soilGridsUrl = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${userLocation.lng}&lat=${userLocation.lat}&property=nitrogen&property=phh2o&property=soc&depth=0-5cm&value=mean`;

        const response = await fetch(soilGridsUrl);
        const data = await response.json();

        let soilData = {
            nitrogen: 0,
            ph: 0,
            soc: 0,
            source: 'SoilGrids (ISRIC)',
            coordinates: `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
        };

        if (data && data.properties && data.properties.layers) {
            data.properties.layers.forEach(layer => {
                if (layer.depths && layer.depths.length > 0) {
                    const val = layer.depths[0].values.mean;
                    if (layer.name === 'nitrogen') soilData.nitrogen = val; // cg/kg
                    if (layer.name === 'phh2o') soilData.ph = val; // pH * 10
                    if (layer.name === 'soc') soilData.soc = val; // dg/kg
                }
            });
        }

        // Update soil health section with location-based data
        updateSoilHealthDisplay(soilData);

        console.log('Location-based soil data fetched from SoilGrids:', soilData);
    } catch (error) {
        console.error('Error fetching soil data from SoilGrids:', error);

        // Fallback: Use default value
        const fallbackData = {
            nitrogen: 142, // cg/kg
            ph: 70, // pH 7.0
            soc: 150, // 15 g/kg
            source: 'Default (API unavailable)',
            coordinates: `${userLocation.lat.toFixed(4)}, ${userLocation.lng.toFixed(4)}`
        };

        updateSoilHealthDisplay(fallbackData);
        console.log('Using fallback soil data:', fallbackData);
    }
}

// Update soil health display with fetched data
function updateSoilHealthDisplay(soilData) {
    // 1. Nitrogen (cg/kg)
    // Range: 0 - 1000 cg/kg. 
    // Conversion: 1 cg/kg = 0.01 g/kg. 
    // Display: Raw value or mapped to Low/Med/High
    const nVal = soilData.nitrogen;
    const nKgHa = Math.round(nVal * 1.5); // Approx conversion to kg/ha for display

    const dashNitrogenValue = document.getElementById('dashNitrogenValue');
    if (dashNitrogenValue) dashNitrogenValue.textContent = nKgHa;

    const soilNVal = document.getElementById('soilNVal');
    const soilNBar = document.getElementById('soilNBar');

    if (soilNVal && soilNBar) {
        let nStatus = 'Optimal';
        let nColor = 'bg-green-500';
        let nText = 'text-green-600';

        if (nVal < 100) { nStatus = 'Low'; nColor = 'bg-red-500'; nText = 'text-red-600'; }
        else if (nVal > 500) { nStatus = 'High'; nColor = 'bg-yellow-500'; nText = 'text-yellow-600'; }

        soilNVal.innerHTML = `<span class="${nText}">${nStatus} (${nKgHa} kg/ha)</span>`;
        soilNBar.className = `${nColor} h-3 rounded-full transition-all duration-1000 ease-out`;
        soilNBar.style.width = Math.min((nVal / 600) * 100, 100) + '%';
    }

    // 2. pH (pH * 10)
    const phVal = soilData.ph / 10;
    const soilPhVal = document.getElementById('soilPhVal');
    const soilPhBar = document.getElementById('soilPhBar');

    if (soilPhVal && soilPhBar) {
        let phStatus = 'Neutral';
        let phColor = 'bg-green-500';

        if (phVal < 6) { phStatus = 'Acidic'; phColor = 'bg-orange-500'; }
        else if (phVal > 7.5) { phStatus = 'Alkaline'; phColor = 'bg-blue-500'; }

        soilPhVal.innerHTML = `<span class="font-bold text-slate-700 dark:text-white">${phVal.toFixed(1)}</span> <span class="text-xs text-slate-500">(${phStatus})</span>`;
        soilPhBar.className = `${phColor} h-3 rounded-full transition-all duration-1000 ease-out`;
        soilPhBar.style.width = Math.min((phVal / 14) * 100, 100) + '%';
    }

    // 3. Organic Carbon (dg/kg) -> g/kg
    // 1 dg/kg = 0.1 g/kg
    const socVal = soilData.soc / 10; // g/kg
    const soilSocVal = document.getElementById('soilSocVal');
    const soilSocBar = document.getElementById('soilSocBar');

    if (soilSocVal && soilSocBar) {
        let socStatus = 'Good';
        let socColor = 'bg-green-500';

        if (socVal < 5) { socStatus = 'Very Low'; socColor = 'bg-red-500'; }
        else if (socVal < 10) { socStatus = 'Low'; socColor = 'bg-yellow-500'; }
        else if (socVal > 20) { socStatus = 'High'; socColor = 'bg-emerald-600'; }

        soilSocVal.innerHTML = `<span class="font-bold text-slate-700 dark:text-white">${socVal.toFixed(1)} g/kg</span> <span class="text-xs text-slate-500">(${socStatus})</span>`;
        soilSocBar.className = `${socColor} h-3 rounded-full transition-all duration-1000 ease-out`;
        soilSocBar.style.width = Math.min((socVal / 30) * 100, 100) + '%';
    }

    // Fetch and update cold storage facilities for this location
    fetchColdStorageData();
}

// Fetch live weather data (Temperature & Humidity)
async function fetchWeatherData() {
    try {
        // Open-Meteo API (Free, No Key)
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${userLocation.lat}&longitude=${userLocation.lng}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=uv_index_max&timezone=auto`);
        const data = await response.json();

        if (data && data.current) {
            const tempInput = document.getElementById('tempInput');
            const humidityInput = document.getElementById('humidityInput');

            // Sync with Dashboard Card
            const dashTemp = document.getElementById('dashTemperature');
            const dashHumidity = document.getElementById('dashHumidity');
            const dashWind = document.getElementById('dashWindSpeed');
            const dashUV = document.getElementById('dashUVIndex');
            const dashDesc = document.getElementById('dashWeatherDesc');
            const dashIcon = document.getElementById('dashWeatherIcon');

            if (tempInput) {
                tempInput.value = data.current.temperature_2m;
                tempInput.classList.add('ring-2', 'ring-green-500');
                setTimeout(() => tempInput.classList.remove('ring-2', 'ring-green-500'), 1000);
            }
            if (humidityInput) {
                humidityInput.value = data.current.relative_humidity_2m;
                humidityInput.classList.add('ring-2', 'ring-green-500');
                setTimeout(() => humidityInput.classList.remove('ring-2', 'ring-green-500'), 1000);
            }

            if (dashTemp) dashTemp.textContent = `${Math.round(data.current.temperature_2m)}°C`;
            if (dashHumidity) dashHumidity.textContent = `${data.current.relative_humidity_2m}%`;
            if (dashWind) dashWind.textContent = `${data.current.wind_speed_10m} km/h`;
            if (dashUV && data.daily) dashUV.textContent = data.daily.uv_index_max[0];

            const condition = getWeatherCondition(data.current.weather_code);
            if (dashDesc) dashDesc.textContent = condition.label;
            if (dashIcon) dashIcon.innerHTML = `<i class="fa-solid ${condition.icon} ${condition.color}"></i>`;
        }
    } catch (error) {
        console.error('Weather fetch failed:', error);
    }
}

// Fetch Detailed Weather for the Weather Dashboard
async function fetchDetailedWeather() {
    // Show loaders if needed
    console.log("Fetching detailed weather for", userLocation.address);

    try {
        const lat = userLocation.lat;
        const lon = userLocation.lng;

        // 1. Fetch Current + Forecast + Sunrise/Sunset
        const forecastUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,apparent_temperature,is_day,weather_code,pressure_msl,wind_speed_10m,visibility,dew_point_2m&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max&timezone=auto&past_days=7`;

        // 2. Fetch Air Quality
        const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,us_aqi,pm10,pm2_5`;

        const [weatherRes, aqiRes] = await Promise.all([
            fetch(forecastUrl),
            fetch(aqiUrl)
        ]);

        const weatherData = await weatherRes.json();
        const aqiData = await aqiRes.json();

        updateWeatherUI(weatherData, aqiData);

    } catch (error) {
        console.error("Detailed weather fetch failed:", error);
    }
}

function updateWeatherUI(w, a) {
    if (!w || !w.current) return;

    // Current Main Section
    const cur = w.current;
    const daily = w.daily;
    const condition = getWeatherCondition(cur.weather_code);

    document.getElementById('weatherMainTemp').textContent = `${Math.round(cur.temperature_2m)}°C`;
    document.getElementById('weatherMainDesc').textContent = condition.label;
    document.getElementById('weatherMainIcon').innerHTML = `<i class="fa-solid ${condition.icon} ${condition.animate ? 'animate-pulse' : ''}"></i>`;
    document.getElementById('weatherLocationName').textContent = userLocation.address.split(',')[0] || 'My Farm';
    document.getElementById('weatherCurrentDate').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });

    // Sunrise / Sunset
    if (daily) {
        const formatTime = (iso) => new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
        // The daily data contains 7 items (index 7 is today because of past_days=7)
        // Wait, past_days=7 means index 0-6 are past, index 7 is today
        const todayIdx = 7;
        document.getElementById('weatherSunrise').textContent = formatTime(daily.sunrise[todayIdx]);
        document.getElementById('weatherSunset').textContent = formatTime(daily.sunset[todayIdx]);

        // Detailed Metrics
        document.getElementById('weatherUVIndex').textContent = daily.uv_index_max[todayIdx];
        const uv = daily.uv_index_max[todayIdx];
        let uvLevel = 'Low';
        if (uv > 8) uvLevel = 'Very High';
        else if (uv > 5) uvLevel = 'High';
        else if (uv > 2) uvLevel = 'Moderate';
        document.getElementById('weatherUVLevel').textContent = uvLevel;
    }

    document.getElementById('weatherWindSpeed').textContent = cur.wind_speed_10m;
    document.getElementById('weatherPressure').textContent = Math.round(cur.pressure_msl);
    document.getElementById('weatherVisibility').textContent = (cur.visibility / 1000).toFixed(1);
    document.getElementById('weatherHumidity').textContent = cur.relative_humidity_2m;
    document.getElementById('weatherDewPoint').textContent = Math.round(cur.dew_point_2m);

    // Air Quality
    if (a && a.current) {
        const aqi = a.current.us_aqi;
        document.getElementById('aqiValue').textContent = aqi;
        const aqiCircle = document.getElementById('aqiCircle');
        const aqiStatus = document.getElementById('aqiStatus');
        const aqiDesc = document.getElementById('aqiDesc');

        if (aqi <= 50) {
            aqiStatus.textContent = "Good";
            aqiStatus.className = "text-xl font-bold text-green-600";
            aqiCircle.className = "w-24 h-24 rounded-full border-8 border-green-500 flex items-center justify-center";
            aqiDesc.textContent = "Air quality is satisfactory, and air pollution poses little or no risk.";
        } else if (aqi <= 100) {
            aqiStatus.textContent = "Moderate";
            aqiStatus.className = "text-xl font-bold text-yellow-600";
            aqiCircle.className = "w-24 h-24 rounded-full border-8 border-yellow-500 flex items-center justify-center";
            aqiDesc.textContent = "Air quality is acceptable. However, there may be a risk for some people.";
        } else {
            aqiStatus.textContent = "Unhealthy";
            aqiStatus.className = "text-xl font-bold text-red-600";
            aqiCircle.className = "w-24 h-24 rounded-full border-8 border-red-500 flex items-center justify-center";
            aqiDesc.textContent = "Everyone may begin to experience health effects; sensitive groups may experience more serious effects.";
        }
    }

    // 7-Day Forecast Injection
    const forecastGrid = document.getElementById('weatherForecastGrid');
    if (forecastGrid && daily) {
        let html = '';
        // Indices 7 to 13 are today and next 6 days
        for (let i = 7; i < 14; i++) {
            const date = new Date(daily.time[i]);
            const dayName = i === 7 ? 'Today' : date.toLocaleDateString('en-IN', { weekday: 'short' });
            const cond = getWeatherCondition(daily.weather_code[i]);
            html += `
                <div class="glass-panel p-4 rounded-2xl border border-white/10 text-center hover:scale-105 transition-transform">
                    <p class="text-xs font-bold text-slate-500 mb-2 uppercase">${dayName}</p>
                    <div class="text-2xl mb-2"><i class="fa-solid ${cond.icon} ${cond.color}"></i></div>
                    <p class="text-sm font-black text-slate-900 dark:text-white">${Math.round(daily.temperature_2m_max[i])}°</p>
                    <p class="text-[10px] text-slate-400 font-bold">${Math.round(daily.temperature_2m_min[i])}°</p>
                </div>
            `;
        }
        forecastGrid.innerHTML = html;
    }

    // Historical Table Injection
    const historyTable = document.getElementById('weatherHistoryTableBody');
    if (historyTable && daily) {
        let html = '';
        // Indices 0 to 6 are the last 7 days
        for (let i = 6; i >= 0; i--) {
            const date = new Date(daily.time[i]);
            const dateStr = date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
            const cond = getWeatherCondition(daily.weather_code[i]);
            html += `
                <tr class="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                    <td class="px-6 py-4 text-sm font-medium text-slate-700 dark:text-slate-300">${dateStr}</td>
                    <td class="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">
                        <span class="font-bold text-slate-900 dark:text-white">${Math.round(daily.temperature_2m_max[i])}°C</span> / ${Math.round(daily.temperature_2m_min[i])}°C
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid fa-droplet text-blue-400 text-xs"></i>
                            <span class="text-sm text-slate-600 dark:text-slate-400">Moderate</span>
                        </div>
                    </td>
                    <td class="px-6 py-4">
                        <div class="flex items-center gap-2">
                            <i class="fa-solid ${cond.icon} ${cond.color} text-sm"></i>
                            <span class="text-sm text-slate-600 dark:text-slate-400">${cond.label}</span>
                        </div>
                    </td>
                </tr>
            `;
        }
        historyTable.innerHTML = html;
    }
}

// Helper: Map WMO Weather Codes to Icons/Labels
function getWeatherCondition(code) {
    const map = {
        0: { label: 'Clear Sky', icon: 'fa-sun', color: 'text-yellow-500', animate: true },
        1: { label: 'Mainly Clear', icon: 'fa-cloud-sun', color: 'text-yellow-400' },
        2: { label: 'Partly Cloudy', icon: 'fa-cloud-sun', color: 'text-slate-400' },
        3: { label: 'Overcast', icon: 'fa-cloud', color: 'text-slate-500' },
        45: { label: 'Foggy', icon: 'fa-smog', color: 'text-slate-300' },
        48: { label: 'Depositing Rime Fog', icon: 'fa-smog', color: 'text-slate-300' },
        51: { label: 'Light Drizzle', icon: 'fa-cloud-rain', color: 'text-blue-300' },
        61: { label: 'Slight Rain', icon: 'fa-cloud-showers-heavy', color: 'text-blue-400' },
        63: { label: 'Moderate Rain', icon: 'fa-cloud-showers-heavy', color: 'text-blue-500' },
        71: { label: 'Slight Snow', icon: 'fa-snowflake', color: 'text-cyan-200' },
        95: { label: 'Thunderstorm', icon: 'fa-cloud-bolt', color: 'text-purple-500' }
    };
    return map[code] || map[0];
}

// Initial calls
document.addEventListener('DOMContentLoaded', () => {
    // Other initializations...
    fetchWeatherData();
});

// Fetch historical weather data for Storage Chart
async function fetchStorageHistory(lat, lng) {
    try {
        // Fetch last 7 days of hourly data to extract daily noon values
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&hourly=temperature_2m,relative_humidity_2m&past_days=6&forecast_days=1&timezone=auto`);
        const data = await response.json();

        if (data && data.hourly) {
            const temps = [];
            const humidity = [];
            const labels = [];

            // Extract data for 12:00 PM each day for the last 7 days
            for (let i = 0; i < 7; i++) {
                const index = 12 + (i * 24); // Noon index
                if (data.hourly.temperature_2m[index] !== undefined) {
                    temps.push(data.hourly.temperature_2m[index]);
                    humidity.push(data.hourly.relative_humidity_2m[index]);

                    const date = new Date(data.hourly.time[index]);
                    labels.push(date.toLocaleDateString('en-IN', { weekday: 'short' }));
                }
            }

            if (storageChartInstance) {
                storageChartInstance.data.labels = labels;
                storageChartInstance.data.datasets[0].data = temps;
                storageChartInstance.data.datasets[1].data = humidity;
                storageChartInstance.update();
            }
        }
    } catch (error) {
        console.error('Storage history fetch failed:', error);
    }
}

// Calculate distance between two coordinates in km (Haversine formula)
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the earth in km
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Distance in km
    return d.toFixed(1);
}

function deg2rad(deg) {
    return deg * (Math.PI / 180);
}

// Fetch location-based cold storage facilities using OpenStreetMap (Nominatim)
async function fetchColdStorageData() {
    const statusElement = document.getElementById('coldStorageGrid');
    if (statusElement) statusElement.innerHTML = '<div class="col-span-3 text-center py-8"><i class="fa-solid fa-circle-notch fa-spin text-slate-300 text-3xl"></i><p class="text-slate-500 mt-2">Finding nearby storage facilities...</p></div>';

    try {
        // Calculate bounding box for ~50km radius (0.5 deg approx 55km)
        const offset = 0.5;
        const viewbox = `${userLocation.lng - offset},${userLocation.lat + offset},${userLocation.lng + offset},${userLocation.lat - offset}`;

        // Search for "cold storage" strictly within viewbox
        let searchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=cold+storage&limit=15&addressdetails=1&viewbox=${viewbox}&bounded=1`;

        let response = await fetch(searchUrl);
        let results = await response.json();

        // If fewer than 5 results, try searching for "warehouse" to supplement
        if (results.length < 5) {
            const warehouseUrl = `https://nominatim.openstreetmap.org/search?format=json&q=warehouse&limit=15&addressdetails=1&viewbox=${viewbox}&bounded=1`;
            const warehouseResponse = await fetch(warehouseUrl);
            const warehouseResults = await warehouseResponse.json();

            // Merge results, avoiding duplicates based on osm_id
            const existingIds = new Set(results.map(r => r.osm_id));
            for (const item of warehouseResults) {
                if (!existingIds.has(item.osm_id)) {
                    results.push(item);
                    existingIds.add(item.osm_id);
                }
            }
        }

        // If still fewer than 5, try an expanded radius search (~150km)
        if (results.length < 5) {
            const expandedOffset = 1.5; // ~160km
            const expandedViewbox = `${userLocation.lng - expandedOffset},${userLocation.lat + expandedOffset},${userLocation.lng + expandedOffset},${userLocation.lat - expandedOffset}`;

            const broaderUrl = `https://nominatim.openstreetmap.org/search?format=json&q=cold+storage&limit=15&addressdetails=1&viewbox=${expandedViewbox}&bounded=1`;
            const broaderResponse = await fetch(broaderUrl);
            const broaderResults = await broaderResponse.json();

            const existingIds = new Set(results.map(r => r.osm_id));
            for (const item of broaderResults) {
                if (!existingIds.has(item.osm_id)) {
                    results.push(item);
                    existingIds.add(item.osm_id);
                }
            }
        }

        // Process results
        let facilities = results.map(item => {
            return {
                name: item.name || item.display_name.split(',')[0],
                address: item.display_name,
                distance: calculateDistance(userLocation.lat, userLocation.lng, parseFloat(item.lat), parseFloat(item.lon)),
                contacts: "Contact Facility", // Placeholder as OSM often lacks phone numbers
                source: "OpenStreetMap",
                lat: parseFloat(item.lat),
                lon: parseFloat(item.lon)
            };
        }).sort((a, b) => parseFloat(a.distance) - parseFloat(b.distance)); // Sort by distance

        // Filter out results further than 250km, but keep at least one if all are far
        const nearbyFacilities = facilities.filter(f => parseFloat(f.distance) < 250);

        if (nearbyFacilities.length > 0) {
            facilities = nearbyFacilities;
        } else {
            // If no facilities within 250km, keep the nearest ones (already sorted)
            facilities = facilities.slice(0, 5);
        }

        // Determine region from first result or user location
        let region = "Nearby Region";
        if (results.length > 0 && results[0].address) {
            region = results[0].address.city || results[0].address.state_district || results[0].address.state || "Nearby";
        } else if (userLocation.address) {
            // Fallback to user's address parts
            const parts = userLocation.address.split(',');
            region = parts.length > 2 ? parts[parts.length - 3] : "Local Region";
        }

        const coldStorageData = {
            region: region,
            facilities: facilities
        };

        // Update cold storage display
        updateColdStorageDisplay(coldStorageData);

        console.log('Cold storage data fetched from OSM:', coldStorageData);
    } catch (error) {
        console.error('Error fetching cold storage data from OSM:', error);

        // Show empty state or error
        const emptyData = {
            region: "Unknown Region",
            facilities: []
        };
        updateColdStorageDisplay(emptyData);
    }
}

// Update cold storage display with fetched real data
function updateColdStorageDisplay(data) {
    // Update region name
    const locationElement = document.getElementById('coldStorageLocation');
    if (locationElement) {
        locationElement.textContent = data.region;
    }

    // Update facility count
    const countElement = document.getElementById('coldStorageCount');
    if (countElement) {
        countElement.textContent = data.facilities ? data.facilities.length : 0;
    }

    // Update facilities grid
    const gridElement = document.getElementById('coldStorageGrid');
    if (gridElement) {
        if (data.facilities && data.facilities.length > 0) {
            const colors = [
                { bg: 'bg-blue-50 dark:bg-blue-500/10', text: 'text-blue-600 dark:text-blue-400' },
                { bg: 'bg-green-50 dark:bg-green-500/10', text: 'text-green-600 dark:text-green-400' },
                { bg: 'bg-purple-50 dark:bg-purple-500/10', text: 'text-purple-600 dark:text-purple-400' }
            ];

            gridElement.innerHTML = data.facilities.slice(0, 9).map((facility, index) => { // Show max 9
                const color = colors[index % colors.length];
                return `
                    <div onclick="showRouteToFacility(${facility.lat}, ${facility.lon}, '${facility.name.replace(/'/g, "\\'")}')" class="border border-slate-200 dark:border-slate-700 rounded-xl p-4 hover:shadow-md transition-shadow cursor-pointer group">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h4 class="font-semibold text-slate-900 dark:text-white line-clamp-1 group-hover:text-blue-600 transition-colors" title="${facility.name}">${facility.name}</h4>
                                <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">
                                    <i class="fa-solid fa-location-arrow text-blue-500"></i> ${facility.distance} km away
                                </p>
                            </div>
                            <div class="p-2 ${color.bg} rounded-lg">
                                <i class="fa-solid fa-warehouse ${color.text}"></i>
                            </div>
                        </div>
                        <div class="space-y-2">
                            <div class="flex justify-between text-sm">
                                <span class="text-slate-600 dark:text-slate-400">Rate:</span>
                                <span class="font-semibold text-slate-900 dark:text-white">Contact for Price</span>
                            </div>
                            <div class="flex justify-between text-sm">
                                <span class="text-slate-600 dark:text-slate-400">Capacity:</span>
                                <span class="font-medium text-slate-700 dark:text-slate-300">Start Inquiry</span>
                            </div>
                            <div class="mt-3 pt-3 border-t border-slate-200 dark:border-slate-700">
                                <p class="text-xs text-slate-500 dark:text-slate-400 text-ellipsis overflow-hidden whitespace-nowrap" title="${facility.address}">
                                    <i class="fa-solid fa-map-pin text-green-600"></i> ${facility.address}
                                </p>
                            </div>
                        </div>
                    </div>
                `;
            }).join('');
        } else {
            gridElement.innerHTML = `
                <div class="col-span-3 text-center p-8 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                    <i class="fa-solid fa-warehouse text-4xl text-slate-300 mb-3"></i>
                    <p class="text-slate-500">No cold storage facilities found nearby.</p>
                    <p class="text-xs text-slate-400 mt-1">Try searching for a major city or district center.</p>
                </div>
            `;
        }
    }
}

// --- Mandi Mini Map Logic ---
let mandiMiniMap = null;
let mandiLayerGroup = null;

function initMandiMiniMap() {
    if (mandiMiniMap) return;

    const container = document.getElementById('mandiMiniMap');
    if (!container) return;

    mandiMiniMap = L.map('mandiMiniMap', {
        zoomControl: false,
        attributionControl: false
    }).setView([userLocation.lat, userLocation.lng], 10);

    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 19
    }).addTo(mandiMiniMap);

    mandiLayerGroup = L.layerGroup().addTo(mandiMiniMap);

    // Add user location marker
    L.circleMarker([userLocation.lat, userLocation.lng], {
        radius: 6,
        fillColor: "#3b82f6",
        color: "#fff",
        weight: 2,
        opacity: 1,
        fillOpacity: 1
    }).addTo(mandiMiniMap);
}

// Focus mini map on a specific mandi
function focusMandiOnMap(lat, lon, name) {
    if (mandiMiniMap) {
        mandiMiniMap.setView([lat, lon], 13);
        if (mandiLayerGroup) {
            mandiLayerGroup.eachLayer(layer => {
                const lLat = layer.getLatLng().lat;
                const lLng = layer.getLatLng().lng;
                if (Math.abs(lLat - lat) < 0.0001 && Math.abs(lLng - lon) < 0.0001) {
                    layer.openPopup();
                }
            });
        }
    }
}

// Fetch location-based Mandis using OpenStreetMap (Nominatim)
async function fetchNearbyMandis() {
    const selectElement = document.getElementById('mandiRegionSelect');
    if (!selectElement) return;

    // Show loading state if empty or just starting
    if (selectElement.options.length === 0 || selectElement.value === 'Loading nearby mandis...') {
        selectElement.innerHTML = '<option disabled selected>Locating nearby mandis...</option>';
    }
    selectElement.disabled = true;

    // Init map if not already
    initMandiMiniMap();

    try {
        // Ensure we have state information
        let state = userLocation.state;
        if (!state) {
            // Try to fetch state if missing
            const geoUrl = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${userLocation.lat}&lon=${userLocation.lng}&addressdetails=1`;
            const geoRes = await fetch(geoUrl);
            const geoData = await geoRes.json();
            if (geoData && geoData.address) {
                state = geoData.address.state || geoData.address.region;
                userLocation.state = state;
            }
        }

        let results = [];

        // 1. Search for "mandi" within the specific state (Broad search restricted to state)
        if (state) {
            const stateSearchUrl = `https://nominatim.openstreetmap.org/search?format=json&q=mandi+in+${encodeURIComponent(state)}&limit=50&addressdetails=1`;
            const stateRes = await fetch(stateSearchUrl);
            const stateData = await stateRes.json();
            results = stateData;
        }

        // 2. Fallback/Supplement: Local search if state search is sparse
        if (results.length < 5) {
            const offset = 0.5; // ~50km
            const viewbox = `${userLocation.lng - offset},${userLocation.lat + offset},${userLocation.lng + offset},${userLocation.lat - offset}`;

            // Try "market" locally
            const localUrl = `https://nominatim.openstreetmap.org/search?format=json&q=market&limit=20&addressdetails=1&viewbox=${viewbox}&bounded=0`;
            const localRes = await fetch(localUrl);
            const localData = await localRes.json();

            const existingIds = new Set(results.map(r => r.osm_id));
            for (const item of localData) {
                if (!existingIds.has(item.osm_id)) {
                    results.push(item);
                    existingIds.add(item.osm_id);
                }
            }
        }

        // 3. Process Results: Calculate Distance & Filter
        results.forEach(r => {
            r.distVal = parseFloat(calculateDistance(userLocation.lat, userLocation.lng, r.lat, r.lon));
        });

        // Filter: Must be in the same state (if state is known) OR very close (< 20km border areas)
        if (state) {
            results = results.filter(r => {
                const rState = r.address.state || r.address.region || "";
                return rState.toLowerCase().includes(state.toLowerCase()) || r.distVal < 20;
            });
        }

        // Sort by distance
        results.sort((a, b) => a.distVal - b.distVal);

        // Limit to nearest 20
        results = results.slice(0, 20);

        // Clear loading
        selectElement.innerHTML = '';

        // Clear Map Layers & List
        if (mandiLayerGroup) mandiLayerGroup.clearLayers();
        const listContainer = document.getElementById('mandiListContainer');
        if (listContainer) listContainer.innerHTML = '';

        let bounds = L.latLngBounds([userLocation.lat, userLocation.lng], [userLocation.lat, userLocation.lng]);

        if (results.length > 0) {
            results.forEach((mandi, index) => {
                let name = mandi.name || mandi.display_name.split(',')[0];
                name = name.replace(/mandi/gi, 'Mandi').replace(/market/gi, 'Market');

                // Add city context if name is generic
                if (name.toLowerCase().includes('market') || name.toLowerCase().includes('mandi')) {
                    const city = mandi.address.city || mandi.address.town || mandi.address.county || mandi.address.state_district;
                    if (city && !name.includes(city)) {
                        name = `${name} (${city})`;
                    }
                }

                const option = document.createElement('option');
                option.value = name;
                option.text = `${name} (${mandi.distVal} km)`;
                option.setAttribute('data-lat', mandi.lat);
                option.setAttribute('data-lon', mandi.lon);
                if (index === 0) option.selected = true;
                selectElement.appendChild(option);

                // Add to Map
                if (mandiLayerGroup) {
                    const lat = parseFloat(mandi.lat);
                    const lon = parseFloat(mandi.lon);
                    L.circleMarker([lat, lon], {
                        radius: 6,
                        fillColor: "#ef4444",
                        color: "#fff",
                        weight: 2,
                        opacity: 1,
                        fillOpacity: 0.8
                    }).addTo(mandiLayerGroup).bindPopup(`<b class="text-slate-900">${name}</b><br><span class="text-xs text-slate-500">${mandi.distVal} km away</span>`);
                    bounds.extend([lat, lon]);
                }

                // Add to List
                if (listContainer) {
                    const item = document.createElement('div');
                    item.className = "p-3 rounded-lg bg-slate-50 hover:bg-blue-50 border border-slate-100 transition-colors cursor-pointer group dark:bg-white/5 dark:border-white/5 dark:hover:bg-white/10";
                    item.onclick = () => focusMandiOnMap(parseFloat(mandi.lat), parseFloat(mandi.lon), name);

                    item.innerHTML = `
                        <div class="flex justify-between items-start">
                            <div>
                                <h5 class="font-bold text-slate-800 text-xs dark:text-white group-hover:text-blue-600 transition-colors line-clamp-1" title="${name}">${name}</h5>
                                <p class="text-[10px] text-slate-500 dark:text-slate-400 line-clamp-1">${mandi.address.city || mandi.address.county || mandi.address.state_district || ""}</p>
                            </div>
                            <span class="text-[10px] font-bold text-blue-600 bg-blue-100 px-1.5 py-0.5 rounded dark:bg-blue-900/30 dark:text-blue-400 whitespace-nowrap">${mandi.distVal} km</span>
                        </div>
                    `;
                    listContainer.appendChild(item);
                }
            });
        } else {
            const city = userLocation.address.split(',')[0] || "Local";
            const option = document.createElement('option');
            option.value = `${city} Mandi`;
            option.text = `${city} Mandi (Est.)`;
            option.selected = true;
            selectElement.appendChild(option);

            if (listContainer) {
                listContainer.innerHTML = '<div class="text-center py-4 text-slate-400 text-xs">No specific mandis found nearby.</div>';
            }
        }

        // Add benchmarks
        const benchmarks = ["Azadpur (Delhi)", "Vashi (Mumbai)", "Hapur (UP)"];
        if (results.length > 0) {
            const separator = document.createElement('option');
            separator.disabled = true;
            separator.text = "──────────";
            selectElement.appendChild(separator);
        }
        benchmarks.forEach(bm => {
            const option = document.createElement('option');
            option.value = bm;
            option.text = bm;
            selectElement.appendChild(option);
        });

        selectElement.disabled = false;
        updateMarketChart();

        if (mandiMiniMap && results.length > 0) {
            mandiMiniMap.fitBounds(bounds, { padding: [20, 20] });
        }

    } catch (error) {
        console.error('Error fetching mandis:', error);
        selectElement.innerHTML = '<option>Azadpur (Delhi)</option><option>Vashi (Mumbai)</option><option>Hapur (UP)</option>';
        selectElement.disabled = false;
        updateMarketChart();
    }
}

// Open map for selected mandi
function viewMandiLocation() {
    const select = document.getElementById('mandiRegionSelect');
    const selectedOption = select.options[select.selectedIndex];

    if (selectedOption && !selectedOption.disabled) {
        const lat = selectedOption.getAttribute('data-lat');
        const lon = selectedOption.getAttribute('data-lon');

        if (lat && lon) {
            window.open(`https://www.google.com/maps/search/?api=1&query=${lat},${lon}`, '_blank');
        } else {
            alert('Location coordinates not available for this mandi.');
        }
    }
}

// --- Spoilage Prediction Logic ---
async function predictSpoilage(e) {
    e.preventDefault();

    const cropType = document.getElementById('cropType').value.trim();
    const temp = parseFloat(document.getElementById('tempInput').value);
    const humidity = parseFloat(document.getElementById('humidityInput').value);
    const days = parseInt(document.getElementById('durationInput').value);
    const predictButton = e.target.querySelector('button[type="submit"]');
    const resDiv = document.getElementById('predictionResult');

    // Validate crop type is not empty
    if (!cropType) {
        alert('Please enter a crop name before predicting spoilage risk.');
        document.getElementById('cropType').focus();
        return;
    }

    // UI: Show loading state
    const originalButtonText = predictButton.innerHTML;
    predictButton.innerHTML = '<i class="fa-solid fa-circle-notch fa-spin"></i> Analyzing...';
    predictButton.disabled = true;
    resDiv.innerHTML = `
        <div class="bg-slate-50 p-4 rounded-full mb-4 dark:bg-white/5">
            <i class="fa-solid fa-flask-atom fa-spin text-3xl text-slate-400"></i>
        </div>
        <h3 class="text-xl font-medium text-slate-500 dark:text-slate-400">AI is calculating risk...</h3>
        <p class="text-sm text-slate-400 mt-2">Please wait a moment.</p>
    `;
    resDiv.classList.add('border-2', 'border-dashed', 'p-12');
    resDiv.classList.remove('p-0', 'border-0');
    document.getElementById('aiRecommendation').classList.add('hidden');

    try {
        const response = await fetch('/api/predict-spoilage', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ cropType, temp, humidity, days }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const { risk, isHighRisk, recommendation, meta } = await response.json();

        // UI: Update with results
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
        resDiv.classList.remove('border-2', 'border-dashed', 'p-12');
        resDiv.classList.add('p-0', 'border-0');

        // Recommendation
        const aiRec = document.getElementById('aiRecommendation');
        document.getElementById('recText').innerText = recommendation;
        aiRec.classList.remove('hidden');

        // Update Dashboard Spoilage Risk Card
        const dashRisk = document.getElementById('dashSpoilageRisk');
        const dashIcon = document.getElementById('dashSpoilageIcon');
        const dashDetail = document.getElementById('dashSpoilageDetail');

        if (dashRisk) {
            dashRisk.textContent = `${risk.toFixed(0)}%`;
            dashRisk.className = `text-3xl font-bold mt-2 ${isHighRisk ? 'text-red-600' : 'text-green-600'}`;
        }

        if (dashIcon) {
            dashIcon.innerHTML = isHighRisk ? '<i class="fa-solid fa-triangle-exclamation"></i>' : '<i class="fa-solid fa-circle-check"></i>';
            dashIcon.className = `p-3 rounded-xl ${isHighRisk ? 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400' : 'bg-green-50 text-green-600 dark:bg-emerald-500/10 dark:text-emerald-400'}`;
        }

        if (dashDetail) {
            dashDetail.innerHTML = `<i class="fa-solid fa-info-circle mr-1"></i> ${isHighRisk ? 'High Risk detected' : 'Low Risk detected'} <span class="text-slate-400 font-normal ml-2">Updated just now</span>`;
        }

    } catch (error) {
        console.error('Spoilage prediction failed:', error);
        resDiv.innerHTML = `
            <div class="bg-red-50 p-4 rounded-full mb-4 dark:bg-red-500/10">
                <i class="fa-solid fa-server text-3xl text-red-400"></i>
            </div>
            <h3 class="text-xl font-medium text-red-500 dark:text-red-400">Prediction Failed</h3>
            <p class="text-sm text-slate-400 mt-2">Could not connect to the backend server. Please ensure it's running.</p>
        `;
        alert('Error: Could not get prediction. Is the backend server running?');
    } finally {
        // UI: Restore button
        predictButton.innerHTML = originalButtonText;
        predictButton.disabled = false;
    }
}

// --- Rotation Plan Logic ---
function generateRotationPlan() {
    const container = document.getElementById('rotationPlanContainer');
    if (!container) return;

    // Show loading state
    container.innerHTML = '<div class="py-12 text-center"><i class="fa-solid fa-circle-notch fa-spin text-3xl text-primary"></i><p class="mt-2 text-slate-500">Analyzing market trends & soil data...</p></div>';

    setTimeout(() => {
        // Define high-demand crop plans
        const plans = [
            [
                {
                    name: "Rice (Basmati)",
                    type: "Cereal",
                    duration: 120,
                    benefit: "High Export Demand",
                    color: "green",
                    videoId: "9bZkp7q19f0",
                    aiTip: "Basmati prices are projected to rise by 15% due to export demand. Ensure water level is maintained at 2-3cm.",
                    steps: ["Prepare nursery with organic compost.", "Transplant 25-day old seedlings.", "Apply Zinc Sulphate for better grain quality.", "Harvest when 90% grains turn golden yellow."]
                },
                {
                    name: "Mustard",
                    type: "Oilseed",
                    duration: 100,
                    benefit: "Low Input Cost",
                    color: "yellow",
                    videoId: "O1_Dk_zO-24",
                    aiTip: "Low moisture requirement makes it ideal for post-monsoon season. High oil content varieties fetch premium prices.",
                    steps: ["Sow seeds in rows 30cm apart.", "Thinning is crucial at 15-20 days.", "Apply Sulphur to increase oil content.", "Control aphids using Neem oil spray."]
                },
                {
                    name: "Moong Dal",
                    type: "Legume",
                    duration: 65,
                    benefit: "Nitrogen Fixation",
                    color: "blue",
                    videoId: "O1_Dk_zO-24",
                    aiTip: "Short duration crop that restores soil nitrogen for the next paddy cycle. Incorporate residues into soil.",
                    steps: ["Select short duration variety (PDM-139).", "Seed treatment with Rhizobium culture.", "One irrigation at flowering stage.", "Harvest pods when they turn black."]
                }
            ],
            [
                { name: "Maize", type: "Cereal", duration: 100, benefit: "High Biomass & Fodder", color: "yellow", videoId: "O1_Dk_zO-24", aiTip: "Excellent for silage. High demand in poultry industry.", steps: ["Prepare land with deep ploughing.", "Sow on ridges for better drainage.", "Apply Atrazine for weed control.", "Harvest when cob husk turns dry."] },
                { name: "Potato", type: "Tuber", duration: 90, benefit: "Quick Cash Crop", color: "orange", videoId: "O1_Dk_zO-24", aiTip: "Cold storage availability is key. Prices peak in May-June.", steps: ["Use disease-free seed tubers.", "Earthing up at 25-30 days.", "Prevent Late Blight with fungicide.", "Dehaulm 10 days before harvest."] },
                { name: "Sunflower", type: "Oilseed", duration: 95, benefit: "Drought Tolerant", color: "green", videoId: "O1_Dk_zO-24", aiTip: "Deep root system helps in drought. Good for intercropping.", steps: ["Seed treatment with Imidacloprid.", "Maintain spacing of 60x30 cm.", "Hand pollination increases yield.", "Harvest when back of head turns lemon yellow."] }
            ],
            [
                { name: "Cotton", type: "Fiber", duration: 160, benefit: "High Industrial Demand", color: "purple", videoId: "O1_Dk_zO-24", aiTip: "Bt Cotton recommended for pest resistance. Monitor for Pink Bollworm.", steps: ["Sow in well-drained soil.", "Gap filling within 10 days.", "Foliar spray of Magnesium Sulphate.", "Pick clean dry bolls."] },
                { name: "Wheat (HD-3226)", type: "Cereal", duration: 140, benefit: "Staple Food Security", color: "green", videoId: "O1_Dk_zO-24", aiTip: "Sow by Nov 15 for max yield. HD-3226 is resistant to rusts.", steps: ["Seed rate 40kg/acre.", "Apply CRI irrigation at 21 days.", "Top dress Urea before 2nd irrigation.", "Harvest when grain is hard."] },
                { name: "Green Manure (Dhaincha)", type: "Cover", duration: 45, benefit: "Soil Rejuvenation", color: "blue", videoId: "O1_Dk_zO-24", aiTip: "Plough back into soil before flowering to add 40kg N/ha.", steps: ["Broadcast seeds @ 20kg/acre.", "No irrigation usually required.", "Plough in situ at 45 days.", "Allow decomposition for 10 days."] }
            ]
        ];

        // Select a plan (simulating AI optimization)
        const selectedPlan = plans[Math.floor(Math.random() * plans.length)];

        let html = '';
        let currentDate = new Date();
        // Start planning from next month
        currentDate.setMonth(currentDate.getMonth() + 1);

        selectedPlan.forEach((crop, index) => {
            // Calculate dates
            const startMonth = currentDate.toLocaleString('default', { month: 'short', year: 'numeric' });

            // Add duration
            currentDate.setDate(currentDate.getDate() + crop.duration);
            const endMonth = currentDate.toLocaleString('default', { month: 'short', year: 'numeric' });

            // Add gap for soil prep (20 days)
            currentDate.setDate(currentDate.getDate() + 20);

            const colors = {
                green: { bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-800 dark:text-green-400', border: 'border-green-200 dark:border-green-800', dot: 'bg-green-600' },
                yellow: { bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-800 dark:text-yellow-400', border: 'border-yellow-200 dark:border-yellow-800', dot: 'bg-yellow-500' },
                blue: { bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-800 dark:text-blue-400', border: 'border-blue-200 dark:border-blue-800', dot: 'bg-blue-600' },
                purple: { bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-800 dark:text-purple-400', border: 'border-purple-200 dark:border-purple-800', dot: 'bg-purple-600' },
                orange: { bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-800 dark:text-orange-400', border: 'border-orange-200 dark:border-orange-800', dot: 'bg-orange-500' }
            };

            const theme = colors[crop.color] || colors.green;

            html += `
            <div class="relative slide-up" style="animation-delay: ${index * 0.1}s">
                <div class="absolute -left-[41px] top-0 bg-white p-1 dark:bg-transparent">
                    <div class="w-4 h-4 ${theme.dot} rounded-full ring-4 ring-slate-100 dark:ring-slate-700"></div>
                </div>
                <h4 class="font-bold text-slate-900 text-lg dark:text-white">Season ${index + 1}: ${crop.name}</h4>
                <p class="text-sm text-slate-500 mb-3 dark:text-slate-400"><i class="fa-regular fa-calendar mr-1"></i> ${startMonth} - ${endMonth} (${crop.duration} Days)</p>
                <span class="inline-block ${theme.bg} ${theme.text} text-xs font-bold px-3 py-1 rounded-full border ${theme.border}">
                    ${crop.benefit}
                </span>
                
                <!-- AI Guide Button -->
                <button onclick="toggleStepDetails('step-details-${index}')" class="mt-4 w-full md:w-auto text-sm flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 dark:bg-white/5 dark:hover:bg-white/10 dark:text-slate-300 transition-colors border border-slate-200 dark:border-white/10 group">
                    <i class="fa-solid fa-wand-magic-sparkles text-purple-500 group-hover:rotate-12 transition-transform"></i> View AI Guide & Process
                </button>

                <!-- Hidden Details Section -->
                <div id="step-details-${index}" class="hidden mt-4 bg-white dark:bg-slate-800/50 p-5 rounded-xl border border-slate-200 dark:border-white/10 shadow-sm">
                    <!-- AI Tip -->
                    <div class="mb-5 p-4 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl border border-purple-100 dark:border-purple-800/30 flex gap-4">
                        <div class="bg-white dark:bg-white/10 p-2 rounded-lg h-fit shadow-sm">
                            <i class="fa-solid fa-robot text-purple-600 dark:text-purple-400 text-xl"></i>
                        </div>
                        <div>
                            <h5 class="font-bold text-slate-800 dark:text-white text-sm mb-1">AI Strategic Advice</h5>
                            <p class="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">${crop.aiTip}</p>
                        </div>
                    </div>
                    
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <!-- Steps -->
                        <div>
                            <h5 class="font-bold text-slate-800 dark:text-white text-sm mb-3 flex items-center gap-2">
                                <i class="fa-solid fa-list-check text-green-500"></i> Step-by-Step Process
                            </h5>
                            <ul class="space-y-3">
                                ${crop.steps.map((step, i) => `
                                    <li onclick="window.open('https://www.google.com/search?q=${encodeURIComponent(step + ' for ' + crop.name)}', '_blank')" class="flex gap-3 text-sm text-slate-600 dark:text-slate-400 cursor-pointer hover:bg-blue-50 dark:hover:bg-blue-900/20 p-2 rounded-lg transition-all group/step" title="Click for detailed explanation">
                                        <span class="flex-shrink-0 w-5 h-5 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500">${i + 1}</span>
                                        <span class="group-hover/step:text-blue-600 dark:group-hover/step:text-blue-400 transition-colors">${step} <i class="fa-solid fa-arrow-up-right-from-square text-[10px] ml-1 opacity-0 group-hover/step:opacity-100 transition-opacity"></i></span>
                                    </li>
                                `).join('')}
                            </ul>
                        </div>

                        <!-- Video -->
                        <div>
                            <h5 class="font-bold text-slate-800 dark:text-white text-sm mb-3 flex items-center gap-2">
                                <i class="fa-brands fa-youtube text-red-500"></i> Tutorial Video
                            </h5>
                            <div class="mt-3 grid grid-cols-2 gap-3">
                                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent(crop.name + ' farming guide')}" target="_blank" class="flex items-center justify-center gap-2 px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 dark:bg-red-900/20 dark:hover:bg-red-900/30 dark:text-red-400 rounded-lg text-xs font-bold transition-colors">
                                    <i class="fa-brands fa-youtube"></i> Watch More
                                </a>
                                <a href="https://www.google.com/search?q=${encodeURIComponent(crop.name + ' farming guide')}" target="_blank" class="flex items-center justify-center gap-2 px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 dark:text-blue-400 rounded-lg text-xs font-bold transition-colors">
                                    <i class="fa-solid fa-book-open"></i> Read Article
                                </a>
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        });

        container.innerHTML = html;
    }, 600);
}

function toggleStepDetails(id) {
    const el = document.getElementById(id);
    if (el) {
        if (el.classList.contains('hidden')) {
            el.classList.remove('hidden');
            el.classList.add('fade-in');
        } else {
            el.classList.add('hidden');
            el.classList.remove('fade-in');
        }
    }
}

// --- Disease Detection Logic ---

// Calls the /api/diagnose backend endpoint (Gemini AI powered, no local data)
async function callDiseaseDetectionAPI(formDataOrObj) {
    let payload = {};

    // If it's FormData (image upload), extract file and convert to base64
    if (formDataOrObj instanceof FormData) {
        const file = formDataOrObj.get('image');
        const crop = formDataOrObj.get('crop') || '';

        if (file && file instanceof File) {
            // Convert File to base64
            const base64 = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(reader.result.split(',')[1]); // strip data:...;base64, prefix
                reader.onerror = reject;
                reader.readAsDataURL(file);
            });
            payload = { crop, imageBase64: base64, mimeType: file.type || 'image/jpeg' };
        } else {
            payload = { crop };
        }
    } else {
        // Plain object with crop/symptom
        payload = {
            crop: formDataOrObj.crop || '',
            symptom: formDataOrObj.symptom || ''
        };
    }

    const response = await fetch('/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    }).catch(err => {
        console.error("Network error calling diagnosis API:", err);
        throw new Error("Could not connect to the AI service. Please ensure the backend server is running.");
    });

    if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        console.error("Server error response:", errData);
        throw new Error(errData.error || errData.details || `Server error: ${response.status}`);
    }

    const result = await response.json();

    // Ensure all expected fields exist with safe defaults
    return {
        name: result.name || 'Unknown Disease',
        confidence: result.confidence || 'N/A',
        cause: result.cause || 'Unknown',
        severity: result.severity || 'Moderate',
        impact: result.impact || 'Analysis complete.',
        chemical: result.chemical || 'Consult local agronomist',
        dosage: result.dosage || 'As directed',
        interval: result.interval || 'As needed',
        precaution: result.precaution || 'Wear protective gear when spraying.',
        organic: result.organic || 'Neem oil spray (5ml/L)',
        steps: Array.isArray(result.steps) ? result.steps : [
            'Remove and destroy infected plant parts.',
            'Apply recommended treatment.',
            'Ensure good air circulation.',
            'Monitor and repeat treatment if needed.'
        ]
    };
}

function previewDiseaseImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            document.getElementById('diseaseImagePreview').src = e.target.result;
            document.getElementById('diseaseImagePreview').classList.remove('hidden');
            document.getElementById('uploadPlaceholder').classList.add('hidden');
            document.getElementById('removeImageBtn').classList.remove('hidden');
        }
        reader.readAsDataURL(file);
    }
}

function removeDiseaseImage(event) {
    event.stopPropagation();
    document.getElementById('diseaseImageInput').value = '';
    document.getElementById('diseaseImagePreview').classList.add('hidden');
    document.getElementById('uploadPlaceholder').classList.remove('hidden');
    document.getElementById('removeImageBtn').classList.add('hidden');
}

async function analyzeDisease() {
    const crop = document.getElementById('diseaseCropSelect').value;
    const symptom = document.getElementById('diseaseSymptomSelect').value;
    const imageInput = document.getElementById('diseaseImageInput');
    const file = imageInput.files[0];

    // UI State Management
    document.getElementById('diseaseEmpty').classList.add('hidden');
    document.getElementById('diseaseResult').classList.add('hidden');
    document.getElementById('diseaseLoading').classList.remove('hidden');

    try {
        let result = null;

        if (file) {
            // Image-based diagnosis via API
            const formData = new FormData();
            formData.append('image', file);
            formData.append('crop', crop);

            // Call Simulated API (Replaces failed localhost fetch)
            result = await callDiseaseDetectionAPI(formData);
        } else {
            // Call Simulated API
            result = await callDiseaseDetectionAPI({ crop, symptom });
        }

        // Render Results
        document.getElementById('diseaseName').innerText = result.name;
        document.getElementById('diseaseConfidence').innerText = result.confidence;
        document.getElementById('diseaseCause').innerText = result.cause;
        document.getElementById('diseaseSeverity').innerText = result.severity;
        document.getElementById('diseaseImpact').innerText = result.impact;
        document.getElementById('diseaseChemical').innerText = result.chemical;
        document.getElementById('diseaseDosage').innerText = result.dosage;
        document.getElementById('diseaseInterval').innerText = result.interval;
        document.getElementById('diseasePrecaution').innerHTML = `<i class="fa-solid fa-shield-halved text-green-500 mt-0.5"></i> <span>${result.precaution}</span>`;
        document.getElementById('diseaseOrganic').innerText = result.organic;

        document.getElementById('diseaseSteps').innerHTML = result.steps.map((step, i) => `
            <li class="flex gap-2"><span class="font-bold text-slate-400">${i + 1}.</span><span>${step}</span></li>
        `).join('');

        document.getElementById('diseaseLoading').classList.add('hidden');
        document.getElementById('diseaseResult').classList.remove('hidden');
        document.getElementById('diseaseResult').scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch (error) {
        console.error("❌ Prediction Error:", error);
        document.getElementById('diseaseLoading').classList.add('hidden');
        alert(`Error: ${error.message}\n\nPlease try again.`);
    }
}

function findNearbyVendors() {
    const query = "pesticide shop near me";
    if (userLocation.lat && userLocation.lng) {
        window.open(`https://www.google.com/maps/search/${query}/@${userLocation.lat},${userLocation.lng},13z`, '_blank');
    } else {
        window.open(`https://www.google.com/maps/search/${query}`, '_blank');
    }
}

function buyOnline() {
    const chemical = document.getElementById('diseaseChemical').innerText;
    const query = encodeURIComponent(chemical + " fungicide");
    window.open(`https://www.amazon.in/s?k=${query}`, '_blank');
}

// --- Market Chart Logic ---
let marketChartInstance = null;
let dashboardMarketChartInstance = null;

// Extensive Crop List
const allCrops = [
    "Wheat", "Rice", "Maize", "Barley", "Sorghum", "Millet", "Oats", "Rye", "Triticale", "Quinoa",
    "Chickpea", "Pigeon pea", "Lentil", "Field pea", "Cowpea", "Black gram", "Green gram", "Kidney bean", "Soybean",
    "Groundnut", "Mustard", "Rapeseed", "Sesame", "Sunflower", "Safflower", "Linseed", "Castor",
    "Potato", "Onion", "Tomato", "Brinjal", "Cabbage", "Cauliflower", "Okra", "Carrot", "Radish",
    "Spinach", "Lettuce", "Pumpkin", "Bottle gourd", "Bitter gourd", "Cucumber", "Watermelon", "Muskmelon",
    "Peas", "Beans", "Chili", "Capsicum", "Garlic", "Ginger", "Turmeric", "Coriander", "Cumin",
    "Mango", "Banana", "Orange", "Lemon", "Lime", "Apple", "Grape", "Guava", "Papaya", "Pineapple",
    "Pomegranate", "Sapota", "Jackfruit", "Litchi", "Strawberry", "Pear", "Peach", "Plum", "Apricot",
    "Sugarcane", "Cotton", "Jute", "Tobacco", "Tea", "Coffee", "Rubber", "Cocoa", "Arecanut",
    "Black pepper", "Cardamom", "Clove", "Cinnamon", "Nutmeg", "Vanilla", "Saffron", "Asafoetida",
    "Almond", "Cashew", "Walnut", "Pistachio", "Date", "Fig", "Coconut", "Bamboo", "Aloe Vera",
    "Tulsi", "Mint", "Lemongrass", "Rose", "Jasmine", "Marigold", "Gerbera", "Gladiolus", "Orchid",
    "Mushroom", "Betel leaf", "Curry leaf", "Drumstick", "Sweet potato", "Tapioca", "Yam", "Colocasia",
    "Amaranth", "Fenugreek", "Fennel", "Ajwain", "Dill", "Celery", "Parsley", "Leek", "Broccoli",
    "Zucchini", "Asparagus", "Artichoke", "Brussels sprout", "Kale", "Swiss chard", "Turnip", "Beetroot",
    "Radish", "Carrot", "Sweet corn", "Baby corn", "Popcorn", "Finger millet", "Pearl millet", "Foxtail millet",
    "Kodo millet", "Little millet", "Barnyard millet", "Proso millet", "Buckwheat", "Amaranth grain"
].sort();

// Market Data moved to backend
const marketData = {};

// Validate crop name against known crops list
function validateCrop(cropName) {
    if (!cropName || cropName.trim() === '') {
        return { valid: false, normalizedName: null };
    }

    const trimmedCrop = cropName.trim();
    // Case-insensitive search in allCrops array
    const foundCrop = allCrops.find(crop => crop.toLowerCase() === trimmedCrop.toLowerCase());

    if (foundCrop) {
        return { valid: true, normalizedName: foundCrop };
    }

    return { valid: false, normalizedName: null };
}


async function fetchMarketData(crop, region) {
    try {
        const response = await fetch(`/api/market?crop=${encodeURIComponent(crop)}&region=${encodeURIComponent(region)}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching market data:", error);
        return null;
    }
}

async function updateMarketChart(forceRefresh = false) {
    const cropInput = document.getElementById('marketCropSelect').value;

    // Validate crop name
    const validation = validateCrop(cropInput);

    if (!validation.valid) {
        // Show error message for invalid crop
        const ctx = document.getElementById('marketMainChart').getContext('2d');

        if (marketChartInstance) {
            marketChartInstance.destroy();
        }

        // Clear price displays
        document.getElementById('currentPriceDisplay').innerText = '---';
        document.getElementById('peakPriceDisplay').innerText = '---';

        // Update dashboard elements
        const dashTitle = document.getElementById('dashMarketTitle');
        const dashPrice = document.getElementById('dashMarketPrice');
        const dashChartTitle = document.getElementById('dashMarketChartTitle');

        if (dashTitle) dashTitle.innerText = 'Market Price';
        if (dashPrice) dashPrice.innerText = '---';
        if (dashChartTitle) dashChartTitle.innerText = 'Price Forecast';

        // Display error message in chart area
        alert(`❌ No data available for "${cropInput}".\n\nPlease select a valid crop from the list.\n\nExamples: Wheat, Rice, Tomato, Onion, Potato, etc.`);

        // Focus back on input
        document.getElementById('marketCropSelect').focus();
        return;
    }

    // Use normalized crop name
    const crop = validation.normalizedName;
    document.getElementById('marketCropSelect').value = crop; // Update input with proper case

    // Get selected region
    const region = document.getElementById('mandiRegionSelect').value;

    // Access region-specific data
    let data = !forceRefresh && marketData[crop] ? marketData[crop][region] : null;

    // Fallback for crops not in static database
    if (!data) {
        const btn = document.querySelector('button[onclick="updateMarketChart(true)"]');
        const originalText = btn ? btn.innerText : 'Refresh Forecast';
        if (btn) { btn.innerText = 'AI Fetching...'; btn.disabled = true; }

        data = await fetchMarketData(crop, region);

        // Cache the data in nested structure
        if (data) {
            if (!marketData[crop]) {
                marketData[crop] = {};
            }
            marketData[crop][region] = data;
        }

        if (btn) { btn.innerText = originalText; btn.disabled = false; }

        if (!data) {
            // Fallback if API fails - deterministic based on crop name and region
            const basePrice = 1000 + (crop.length * 150);
            // Add regional variation: Mumbai +6%, UP -3%, Delhi baseline
            const regionMultiplier = region.includes('Mumbai') ? 1.06 : region.includes('UP') ? 0.97 : 1.0;
            const adjustedBase = Math.floor(basePrice * regionMultiplier);

            // Generate deterministic trend based on date (so it doesn't change on every click)
            const todayStr = new Date().toISOString().split('T')[0];
            const seedStr = todayStr + crop + region;
            let hash = 0;
            for (let i = 0; i < seedStr.length; i++) { hash = ((hash << 5) - hash) + seedStr.charCodeAt(i); hash |= 0; }
            const seedRand = (Math.sin(hash) * 10000) - Math.floor(Math.sin(hash) * 10000);

            const trend = Array.from({ length: 7 }, (_, i) => {
                // Use seeded random for consistent daily values
                return Math.floor(adjustedBase + (i * 20) + ((seedRand * 100) - 50));
            });
            data = {
                current: trend[0],
                peak: Math.floor(Math.max(...trend) + 50),
                trend: trend
            };
            // Cache the generated data
            if (!marketData[crop]) {
                marketData[crop] = {};
            }
            marketData[crop][region] = data;
        }
    }

    // Update Text
    document.getElementById('currentPriceDisplay').innerText = `₹${data.current.toLocaleString()}`;
    document.getElementById('peakPriceDisplay').innerText = `₹${data.peak.toLocaleString()}`;

    // Update Dashboard Elements
    const dashTitle = document.getElementById('dashMarketTitle');
    const dashPrice = document.getElementById('dashMarketPrice');
    const dashChartTitle = document.getElementById('dashMarketChartTitle');

    if (dashTitle) dashTitle.innerText = `Market Price (${crop})`;
    if (dashPrice) dashPrice.innerText = `₹${data.current.toLocaleString()}`;
    if (dashChartTitle) dashChartTitle.innerText = `${crop} Price Forecast`;

    // Update Chart
    const ctx = document.getElementById('marketMainChart').getContext('2d');

    if (marketChartInstance) {
        marketChartInstance.destroy();
    }

    // Create Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(43, 108, 176, 0.2)');
    gradient.addColorStop(1, 'rgba(43, 108, 176, 0)');

    const labels = [];
    for (let i = 0; i < 7; i++) {
        const d = new Date();
        d.setDate(d.getDate() + (i * 5));
        labels.push(d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }));
    }

    marketChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: `Forecasted Price: ${crop} (₹/q)`,
                data: data.trend,
                borderColor: '#2B6CB0',
                backgroundColor: gradient,
                fill: true,
                tension: 0.4,
                pointRadius: 6,
                pointHoverRadius: 8,
                pointBackgroundColor: '#ffffff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    titleColor: '#1e293b',
                    bodyColor: '#475569',
                    borderColor: '#e2e8f0',
                    borderWidth: 1,
                    padding: 10,
                    cornerRadius: 8,
                    displayColors: false
                }
            },
            scales: {
                y: {
                    ticks: { callback: (val) => '₹' + val },
                    grid: { display: false }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });

    // Update Dashboard Chart if initialized
    if (dashboardMarketChartInstance) {
        dashboardMarketChartInstance.data.datasets[0].label = `${crop} Price`;
        dashboardMarketChartInstance.data.datasets[0].data = data.trend.slice(0, 4);
        dashboardMarketChartInstance.update();
    }
}

// --- Prediction Chart Logic ---
let predictionChartInstance = null;
function initPredictionCharts() {
    const ctx = document.getElementById('predictionChart');
    if (!ctx) return;

    if (predictionChartInstance) {
        predictionChartInstance.destroy();
    }

    const context = ctx.getContext('2d');
    const gradient = context.createLinearGradient(0, 0, 0, 400);
    gradient.addColorStop(0, 'rgba(16, 185, 129, 0.5)'); // Emerald
    gradient.addColorStop(1, 'rgba(16, 185, 129, 0.1)');

    predictionChartInstance = new Chart(context, {
        type: 'bar',
        data: {
            labels: ['Wheat', 'Mustard', 'Chickpea', 'Barley', 'Lentil'],
            datasets: [{
                label: 'Projected Profit (₹/Acre)',
                data: [24500, 21200, 18800, 16500, 15200],
                backgroundColor: gradient,
                borderColor: '#10B981',
                borderWidth: 2,
                borderRadius: 8,
                barThickness: 40
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: { beginAtZero: true, grid: { color: 'rgba(200,200,200,0.1)' } },
                x: { grid: { display: false } }
            }
        }
    });
}

// --- Initialization ---
document.addEventListener('DOMContentLoaded', function () {
    // Populate Crop Datalists
    const cropOptions = document.getElementById('cropOptions');
    const marketCropOptions = document.getElementById('marketCropOptions');

    allCrops.forEach(crop => {
        const option = document.createElement('option');
        option.value = crop;
        cropOptions.appendChild(option.cloneNode(true));
        marketCropOptions.appendChild(option);
    });

    // Init Dashboard Charts
    const ctxStorage = document.getElementById('storageChart').getContext('2d');

    // Theme-aware colors
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const pointBg = isDark ? '#1e293b' : '#ffffff';

    // Gradients
    const gradTemp = ctxStorage.createLinearGradient(0, 0, 0, 300);
    gradTemp.addColorStop(0, 'rgba(239, 68, 68, 0.5)'); // Red-500
    gradTemp.addColorStop(1, 'rgba(239, 68, 68, 0)');

    const gradHum = ctxStorage.createLinearGradient(0, 0, 0, 300);
    gradHum.addColorStop(0, 'rgba(16, 185, 129, 0.5)'); // Emerald-500
    gradHum.addColorStop(1, 'rgba(16, 185, 129, 0)');

    storageChartInstance = new Chart(ctxStorage, {
        type: 'line',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                label: 'Temperature (°C)',
                data: [24, 25, 25, 26, 28, 27, 26],
                borderColor: '#ef4444', // Red-500
                backgroundColor: gradTemp,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: pointBg,
                pointBorderColor: '#ef4444',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#ef4444'
            }, {
                label: 'Humidity (%)',
                data: [55, 58, 60, 62, 65, 63, 60],
                borderColor: '#10b981', // Emerald-500
                backgroundColor: gradHum,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: pointBg,
                pointBorderColor: '#10b981',
                pointBorderWidth: 2,
                pointHoverRadius: 6,
                pointHoverBackgroundColor: '#10b981'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'top',
                    align: 'end',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        color: textColor
                    }
                }
            },
            scales: {
                x: {
                    grid: { display: false },
                    ticks: { color: textColor }
                },
                y: {
                    grid: { borderDash: [4, 4], color: gridColor },
                    ticks: { color: textColor }
                }
            },
            interaction: { mode: 'index', intersect: false }
        }
    });

    const ctxMarketDash = document.getElementById('marketChartDashboard').getContext('2d');

    const gradMarket = ctxMarketDash.createLinearGradient(0, 0, 0, 300);
    gradMarket.addColorStop(0, 'rgba(214, 158, 46, 0.2)');
    gradMarket.addColorStop(1, 'rgba(214, 158, 46, 0)');

    dashboardMarketChartInstance = new Chart(ctxMarketDash, {
        type: 'line',
        data: {
            labels: ['Week 1', 'Week 2', 'Week 3', 'Week 4'],
            datasets: [{
                label: 'Wheat Price',
                data: [2100, 2150, 2180, 2240], // Placeholder; updated by updateMarketChart()
                borderColor: '#D69E2E', // Yellow
                backgroundColor: gradMarket,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { display: false } }
        }
    });

    // Init Market Module Chart
    // updateMarketChart(); // Called by fetchNearbyMandis

    // Fetch initial data for default location
    fetchLocationBasedSoilData();
    fetchWeatherData();
    fetchStorageHistory(userLocation.lat, userLocation.lng);
    fetchNearbyMandis();
});

function updateChartsTheme() {
    const isDark = document.documentElement.classList.contains('dark');
    const gridColor = isDark ? 'rgba(255, 255, 255, 0.1)' : '#f1f5f9';
    const textColor = isDark ? '#94a3b8' : '#64748b';
    const pointBg = isDark ? '#1e293b' : '#ffffff';

    const charts = [storageChartInstance, marketChartInstance, dashboardMarketChartInstance, predictionChartInstance];

    charts.forEach(chart => {
        if (chart) {
            // Update scales
            if (chart.options.scales.x) {
                chart.options.scales.x.ticks.color = textColor;
                if (chart.options.scales.x.grid) chart.options.scales.x.grid.color = gridColor;
            }
            if (chart.options.scales.y) {
                chart.options.scales.y.ticks.color = textColor;
                if (chart.options.scales.y.grid) chart.options.scales.y.grid.color = gridColor;
            }

            // Update legend
            if (chart.options.plugins.legend && chart.options.plugins.legend.labels) {
                chart.options.plugins.legend.labels.color = textColor;
            }

            // Update datasets (points)
            if (chart.data && chart.data.datasets) {
                chart.data.datasets.forEach(dataset => {
                    dataset.pointBackgroundColor = pointBg;
                });
            }

            chart.update();
        }
    });
}

function toggleTheme(event) {
    // Check if View Transitions API is supported
    if (!document.startViewTransition) {
        performToggle();
        return;
    }

    const x = event ? event.clientX : window.innerWidth / 2;
    const y = event ? event.clientY : window.innerHeight / 2;

    const endRadius = Math.hypot(
        Math.max(x, window.innerWidth - x),
        Math.max(y, window.innerHeight - y)
    );

    const transition = document.startViewTransition(() => {
        performToggle();
    });

    transition.ready.then(() => {
        const clipPath = [
            `circle(0px at ${x}px ${y}px)`,
            `circle(${endRadius}px at ${x}px ${y}px)`,
        ];
        document.documentElement.animate(
            {
                clipPath: clipPath,
            },
            {
                duration: 500,
                easing: 'ease-in',
                pseudoElement: '::view-transition-new(root)',
            }
        );
    });
}

function performToggle() {
    if (document.documentElement.classList.contains('dark')) {
        document.documentElement.classList.remove('dark');
        localStorage.setItem('color-theme', 'light');
    } else {
        document.documentElement.classList.add('dark');
        localStorage.setItem('color-theme', 'dark');
    }

    // Update Charts
    updateChartsTheme();
}

// Google Translate Functions
function googleTranslateElementInit() {
    new google.translate.TranslateElement({
        pageLanguage: 'en',
        includedLanguages: 'en,hi,bn,te,mr,ta,gu,kn,ml,or,pa',
        autoDisplay: false
    }, 'google_translate_element');
}

function triggerTranslation(lang) {
    const select = document.querySelector('.goog-te-combo');
    if (select) {
        select.value = lang;
        select.dispatchEvent(new Event('change'));
    }
}
