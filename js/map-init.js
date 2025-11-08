// ============================================================================
// MAP INITIALIZATION
// ============================================================================

// Initialize map centered on Alameda County
var map = L.map('map', { zoomControl: false }).setView([37.8044, -122.2712], 10);

// Add CartoDB Positron (Light) tile layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> & <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

