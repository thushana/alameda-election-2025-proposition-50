// ============================================================================
// MAP INITIALIZATION
// ============================================================================

import { state } from './state.js';
import { getL } from './leaflet-helper.js';
import { setPolygonStyle } from './map-styling.js';
import { getYesPercentage } from './data-helpers.js';
import type { GeoJSONFeature } from './types.js';

// Update all polygon styles based on current zoom level
function updatePolygonStylesOnZoom(): void {
  if (!state.geojsonLayer || !state.map) return;

  const leaflet = getL();

  // Update all polygon layers
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet layer iteration API
  state.geojsonLayer.eachLayer((layer: any) => {
    const feature = layer.feature as GeoJSONFeature | undefined;
    if (!feature) return;

    // Skip circle markers (proportional mode)
    if (layer instanceof leaflet.CircleMarker) return;

    const props = feature.properties;
    const yesPct = getYesPercentage(props);

    // Check if this layer is selected
    const isSelected = state.selectedPrecincts.some((item) => {
      return item.layer === layer;
    });

    // Update style with current zoom level
    setPolygonStyle(layer, yesPct, isSelected);
  });
}

// Wait for Leaflet to be available (loaded via script tag)
function initMap() {
  try {
    const leaflet = getL();

    // Initialize map centered on Alameda County
    const mapInstance = leaflet
      .map('map', { zoomControl: false })
      .setView([37.8044, -122.2712], 10);

    // Update the state object
    state.map = mapInstance;

    // Add CartoDB Positron (Light) tile layer
    leaflet
      .tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        attribution:
          '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> & <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 19,
      })
      .addTo(mapInstance);

    // Add zoom event listener to update polygon stroke weights
    mapInstance.on('zoomend', () => {
      updatePolygonStylesOnZoom();
    });
  } catch (_e) {
    // Retry if Leaflet not loaded yet
    setTimeout(initMap, 10);
  }
}

// Start initialization
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMap);
} else {
  initMap();
}
