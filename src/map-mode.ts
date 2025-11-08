// ============================================================================
// MAP MODE
// ============================================================================

import type { LayerGroup, CircleMarker } from 'leaflet';
import { state } from './state.js';
import { getL } from './leaflet-helper.js';
import { parseHashParams } from './url-manager.js';
import { getVoteCount, getYesPercentage, getCentroid } from './data-helpers.js';
import { getColor, getCircleRadius } from './map-styling.js';
import { highlightFeature, resetHighlight, togglePrecinctSelection } from './map-events.js';
import { updateModeURL } from './url-manager.js';
import type { GeoJSONData, MapMode } from './types.js';

// Map visualization mode: 'shaded' or 'proportional'
// Read from URL hash if present, default to 'shaded'
const hashParams = parseHashParams();
export let mapMode: MapMode = hashParams.mode === 'proportional' ? 'proportional' : 'shaded';
export let circleLayer: LayerGroup<CircleMarker> | null = null;
export let maxVotes = 0; // Will be calculated from data

// Create proportional symbol circles
export function createProportionalSymbols(data: GeoJSONData): void {
  if (!state.map) return;

  const leaflet = getL();

  // Remove existing circle layer
  if (circleLayer) {
    state.map.removeLayer(circleLayer);
  }

  // Calculate max votes for scaling
  maxVotes = 0;
  data.features.forEach((feature) => {
    if (feature.properties && feature.properties.votes && feature.properties.votes.total) {
      maxVotes = Math.max(maxVotes, feature.properties.votes.total);
    }
  });

  // Create circle markers
  const circles: CircleMarker[] = [];
  data.features.forEach((feature) => {
    const props = feature.properties;
    const voteCount = getVoteCount(props);
    const yesPct = getYesPercentage(props);

    const centroid = getCentroid(feature);
    if (centroid && voteCount > 0) {
      const radius = getCircleRadius(voteCount);
      const color = getColor(yesPct);

      const circle = leaflet.circleMarker([centroid[0], centroid[1]], {
        radius: radius,
        fillColor: color,
        color: '#fff',
        weight: 1,
        opacity: 0.8,
        fillOpacity: 0.7,
      });

      // Store feature properties for hover/click
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet layer extension
      (circle as any).feature = feature;

      // Add event listeners
      circle.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: togglePrecinctSelection,
      });

      circles.push(circle);
    }
  });

  circleLayer = leaflet.layerGroup(circles).addTo(state.map);
}

// Toggle map mode
export function toggleMapMode(): void {
  if (!state.map || !state.geojsonLayer) return;

  // Toggle the mode
  mapMode = mapMode === 'shaded' ? 'proportional' : 'shaded';

  // Update URL parameter
  updateModeURL();

  // Update button text to show current mode
  const btn = document.getElementById('toggle-mode-btn');
  if (btn) {
    btn.textContent =
      mapMode === 'proportional' ? 'Mode – Proportional Districts' : 'Mode – Shaded Districts';
  }

  if (mapMode === 'proportional') {
    // Hide polygon layer, show circles
    if (state.geojsonLayer) {
      state.map.removeLayer(state.geojsonLayer);
    }
    // Circles will be created when data loads
  } else {
    // Hide circles, show polygon layer (shaded mode)
    if (circleLayer) {
      state.map.removeLayer(circleLayer);
    }
    if (state.geojsonLayer) {
      state.map.addLayer(state.geojsonLayer);
    }
  }

  // Reload data to apply mode
  if (state.geojsonLayer && state.geojsonLayer.getLayers().length > 0) {
    // Get current data and recreate visualization
    const currentData: GeoJSONData = { type: 'FeatureCollection', features: [] };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet layer iteration API
    state.geojsonLayer.eachLayer((layer: any) => {
      if (layer.feature) {
        currentData.features.push(layer.feature);
      }
    });

    if (mapMode === 'proportional') {
      createProportionalSymbols(currentData);
    } else {
      state.geojsonLayer.addTo(state.map);
    }
  }
}

// Make toggleMapMode globally accessible
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Global function assignment
(window as any).toggleMapMode = toggleMapMode;
