// ============================================================================
// URL MANAGER
// ============================================================================

import { state } from './state.js';
import { mapMode } from './map-mode.js';
import { normalizeCityName } from './city-helpers.js';
import { getPrecinctId } from './data-helpers.js';
import type { HashParams, MapMode } from './types.js';

// Hash-based URL parsing and building (works with static file servers)
export function parseHashParams(): HashParams {
  const hash = window.location.hash;
  if (!hash || hash.length <= 1) {
    return { mode: null, city: null, precincts: null };
  }
  
  // Remove # from hash, handle both #/mode/... and #mode/...
  let path = hash.substring(1);
  // Remove leading slash if present
  if (path.charAt(0) === '/') {
    path = path.substring(1);
  }
  const parts = path.split('/').filter((p) => p.length > 0);
  const params: HashParams = {
    mode: null,
    city: null,
    precincts: null
  };
  
  // Mode synonyms: choropleth -> shaded, bubble -> proportional
  function normalizeMode(mode: string | null): MapMode | null {
    if (!mode) return null;
    const normalized = mode.toLowerCase();
    if (normalized === 'choropleth') return 'shaded';
    if (normalized === 'bubble' || normalized === 'bubbles') return 'proportional';
    return normalized === 'proportional' ? 'proportional' : 'shaded';
  }
  
  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === 'mode' && i + 1 < parts.length) {
      params.mode = normalizeMode(parts[i + 1]);
      i++;
    } else if (parts[i] === 'city' && i + 1 < parts.length) {
      params.city = parts[i + 1];
      i++;
    } else if (parts[i] === 'precincts' && i + 1 < parts.length) {
      params.precincts = parts[i + 1];
      i++;
    }
  }
  
  return params;
}

export function buildHashParams(params: HashParams): string {
  const pathParts: string[] = [];
  
  // Only include mode if it's not the default 'shaded'
  if (params.mode && params.mode !== 'shaded') {
    pathParts.push('mode', params.mode);
  }
  
  // Add city if present
  if (params.city) {
    pathParts.push('city', params.city);
  }
  
  // Add precincts if present
  if (params.precincts) {
    pathParts.push('precincts', params.precincts);
  }
  
  return '#' + pathParts.join('/');
}

// Update URL with map mode parameter
export function updateModeURL(): void {
  const hashParams = parseHashParams();
  
  // Only update mode if it's not the default 'shaded'
  // This way we don't add mode/shaded/ to URLs unless user switches to proportional
  if (mapMode !== 'shaded') {
    hashParams.mode = mapMode;
  } else {
    // Remove mode from params if it's the default
    hashParams.mode = null;
  }
  
  // Preserve city from URL if it exists, or use currentCityName (normalize for URL)
  if (hashParams.city) {
    // Keep city from URL
  } else if (state.currentCityName) {
    hashParams.city = normalizeCityName(state.currentCityName);
  }
  
  // Preserve precincts from URL if they exist, or use selectedPrecincts
  if (hashParams.precincts) {
    // Keep precincts from URL
  } else if (state.selectedPrecincts.length > 0) {
    const precinctIds = state.selectedPrecincts.map((item) => {
      const id = getPrecinctId(item.feature.properties);
      return id ? id.toString() : 'N/A';
    }).join('+');
    if (precinctIds) {
      hashParams.precincts = precinctIds;
    }
  }
  
  const newHash = buildHashParams(hashParams);
  window.location.hash = newHash;
}

// Update URL with selected precinct numbers
export function updateURL(): void {
  const hashParams = parseHashParams();
  
  // Only include mode if it's not the default 'shaded'
  if (mapMode !== 'shaded') {
    hashParams.mode = mapMode;
  } else {
    hashParams.mode = null;
  }
  
  // Get precinct IDs
  const precinctIds = state.selectedPrecincts.map((item) => {
    const id = getPrecinctId(item.feature.properties);
    return id ? id.toString() : 'N/A';
  }).join('+');
  
  if (precinctIds && state.selectedPrecincts.length > 0) {
    hashParams.precincts = precinctIds;
    // Clear city when manually selecting precincts
    hashParams.city = null;
  } else {
    hashParams.precincts = null;
    // Only include city if we have a city selection and no individual precincts
    if (state.currentCityName) {
      hashParams.city = normalizeCityName(state.currentCityName);
    } else {
      hashParams.city = null;
    }
  }
  
  const newHash = buildHashParams(hashParams);
  window.location.hash = newHash;
}

