// ============================================================================
// MAP INITIALIZATION
// ============================================================================

import L from 'leaflet';
import { state } from './state.js';

// Initialize map centered on Alameda County
const mapInstance = L.map('map', { zoomControl: false }).setView([37.8044, -122.2712], 10);

// Update the state object
state.map = mapInstance;

// Add CartoDB Positron (Light) tile layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
  attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> & <a href="https://carto.com/attributions">CARTO</a>',
  subdomains: 'abcd',
  maxZoom: 19
}).addTo(mapInstance);

