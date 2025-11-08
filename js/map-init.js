// ============================================================================
// MAP INITIALIZATION
// ============================================================================
import { state } from './state.js';
import { getL } from './leaflet-helper.js';
// Wait for Leaflet to be available (loaded via script tag)
function initMap() {
    try {
        const leaflet = getL();
        // Initialize map centered on Alameda County
        const mapInstance = leaflet.map('map', { zoomControl: false }).setView([37.8044, -122.2712], 10);
        // Update the state object
        state.map = mapInstance;
        // Add CartoDB Positron (Light) tile layer
        leaflet.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
            attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> & <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 19
        }).addTo(mapInstance);
    }
    catch (e) {
        // Retry if Leaflet not loaded yet
        setTimeout(initMap, 10);
    }
}
// Start initialization
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMap);
}
else {
    initMap();
}
