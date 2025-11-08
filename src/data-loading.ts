// ============================================================================
// DATA LOADING
// ============================================================================

import { state } from './state.js';
import { getL } from './leaflet-helper.js';
import { mapMode, createProportionalSymbols } from './map-mode.js';
import { style } from './map-styling.js';
import { onEachFeature } from './map-events.js';
import { getPrecinctId } from './data-helpers.js';
import { calculateCityStats } from './city-stats.js';
import { buildCityDropdown } from './ui-city-dropdown.js';
import { updateInfoSection } from './ui-info-section.js';
import { updateCityButtonText } from './ui-city-dropdown.js';
import { parseHashParams, buildHashParams } from './url-manager.js';
import { normalizeCityName, getDisplayCityName } from './city-helpers.js';
import { safeGet } from './data-helpers.js';
import { applyMobileVerticalBias, applyDesktopDefaultBiasIfNeeded } from './map-utils.js';
import { restoreSelectionFromURL } from './state-restore.js';
import { toggleMapMode } from './map-mode.js';
import type { GeoJSONData } from './types.js';

// Initialize GeoJSON layer when Leaflet is available
function initGeoJSONLayer() {
  try {
    const leaflet = getL();
    state.geojsonLayer = leaflet.geoJSON(null, {
      style: style as any,
      onEachFeature: onEachFeature
    });

    // Only add to map if in shaded mode (default is shaded)
    if (mapMode === 'shaded' && state.map && state.geojsonLayer) {
      state.geojsonLayer.addTo(state.map);
    }
    
    // Load data once layer is initialized
    loadData();
  } catch (e) {
    // Retry if Leaflet not loaded yet
    setTimeout(initGeoJSONLayer, 10);
  }
}

// Load GeoJSON data and results.json
function loadData() {
  const leaflet = getL();
  
  Promise.all([
  fetch('precincts_consolidated.geojson').then(response => {
    if (!response.ok) {
      throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
    }
    return response.json();
  }),
  fetch('results.json').then(response => {
    if (!response.ok) {
      throw new Error('Could not load results.json: ' + response.status + ' ' + response.statusText);
    }
    return response.json();
  })
])
  .then((results: [GeoJSONData, any[]]) => {
    const data = results[0];
    const resultsData = results[1];
    
    
    if (!resultsData || !Array.isArray(resultsData)) {
      throw new Error('results.json is invalid or empty');
    }
    
    // Create a map of all vote data from results.json
    const resultsMap: { [key: string]: any } = {};
    resultsData.forEach((result: any) => {
      if (result.precinct) {
        resultsMap[result.precinct.toString()] = {
          votes: result.votes || null,
          percentage: result.percentage || null,
          vote_method: result.vote_method || null
        };
      }
    });
    
    // Merge all vote data from results.json into GeoJSON features
    data.features.forEach((feature) => {
      const precinctId = getPrecinctId(feature.properties);
      
      if (precinctId && resultsMap[precinctId.toString()]) {
        const voteData = resultsMap[precinctId.toString()];
        if (voteData.votes) {
          feature.properties.votes = voteData.votes;
        }
        if (voteData.percentage) {
          feature.properties.percentage = voteData.percentage;
        }
        if (voteData.vote_method) {
          feature.properties.vote_method = voteData.vote_method;
        }
      }
    });
    
    // Calculate city statistics
    state.cityStats = calculateCityStats(data);
    
    // Reset county totals before calculation to prevent accumulation
    state.countyTotals.yes = 0;
    state.countyTotals.no = 0;
    state.countyTotals.total = 0;
    state.countyTotals.mailInTotal = 0;
    state.countyTotals.mailInYes = 0;
    state.countyTotals.mailInNo = 0;
    state.countyTotals.inPersonTotal = 0;
    state.countyTotals.inPersonYes = 0;
    state.countyTotals.inPersonNo = 0;
    
    // Calculate county totals from results.json with error handling
    try {
      resultsData.forEach((result: any) => {
        if (!result) return;
        
        // Calculate overall vote totals
        if (result.votes && typeof result.votes === 'object') {
          const votes = result.votes;
          if (typeof votes.yes === 'number' && votes.yes > 0) {
            state.countyTotals.yes += votes.yes;
          }
          if (typeof votes.no === 'number' && votes.no > 0) {
            state.countyTotals.no += votes.no;
          }
          if (typeof votes.total === 'number' && votes.total > 0) {
            state.countyTotals.total += votes.total;
          }
        }
        
        // Calculate county-level vote method totals
        if (result.vote_method && typeof result.vote_method === 'object') {
          if (result.vote_method.mail_in && result.vote_method.mail_in.votes && typeof result.vote_method.mail_in.votes === 'object') {
            const mailInVotes = result.vote_method.mail_in.votes;
            if (typeof mailInVotes.total === 'number' && mailInVotes.total > 0) {
              state.countyTotals.mailInTotal += mailInVotes.total;
            }
            if (typeof mailInVotes.yes === 'number' && mailInVotes.yes > 0) {
              state.countyTotals.mailInYes += mailInVotes.yes;
            }
            if (typeof mailInVotes.no === 'number' && mailInVotes.no > 0) {
              state.countyTotals.mailInNo += mailInVotes.no;
            }
          }
          if (result.vote_method.in_person && result.vote_method.in_person.votes && typeof result.vote_method.in_person.votes === 'object') {
            const inPersonVotes = result.vote_method.in_person.votes;
            if (typeof inPersonVotes.total === 'number' && inPersonVotes.total > 0) {
              state.countyTotals.inPersonTotal += inPersonVotes.total;
            }
            if (typeof inPersonVotes.yes === 'number' && inPersonVotes.yes > 0) {
              state.countyTotals.inPersonYes += inPersonVotes.yes;
            }
            if (typeof inPersonVotes.no === 'number' && inPersonVotes.no > 0) {
              state.countyTotals.inPersonNo += inPersonVotes.no;
            }
          }
        }
      });
    } catch (error) {
      // Reset to safe defaults on error
      state.countyTotals.yes = 0;
      state.countyTotals.no = 0;
      state.countyTotals.total = 0;
      state.countyTotals.mailInTotal = 0;
      state.countyTotals.mailInYes = 0;
      state.countyTotals.mailInNo = 0;
      state.countyTotals.inPersonTotal = 0;
      state.countyTotals.inPersonYes = 0;
      state.countyTotals.inPersonNo = 0;
    }
    
    // Calculate percentages
    if (state.countyTotals.total > 0) {
      state.countyTotals.yesPct = (state.countyTotals.yes / state.countyTotals.total) * 100;
      state.countyTotals.noPct = (state.countyTotals.no / state.countyTotals.total) * 100;
    } else {
      state.countyTotals.yesPct = 0;
      state.countyTotals.noPct = 0;
    }
    
    // Calculate county-level mail-in percentage of total votes
    if (state.countyTotals.total > 0) {
      state.countyTotals.mailInPctOfTotal = (state.countyTotals.mailInTotal / state.countyTotals.total) * 100;
    } else {
      state.countyTotals.mailInPctOfTotal = 0;
    }
    
    // Calculate county-level mail-in YES percentage
    if (state.countyTotals.mailInTotal > 0) {
      state.countyTotals.mailInYesPct = (state.countyTotals.mailInYes / state.countyTotals.mailInTotal) * 100;
    } else {
      state.countyTotals.mailInYesPct = 0;
    }
    
    // Calculate county-level in-person YES percentage
    if (state.countyTotals.inPersonTotal > 0) {
      state.countyTotals.inPersonYesPct = (state.countyTotals.inPersonYes / state.countyTotals.inPersonTotal) * 100;
    } else {
      state.countyTotals.inPersonYesPct = 0;
    }
    
    // Build city dropdown (after county totals are calculated)
    // Only build once to avoid duplicates
    if (Object.keys(state.cityStats).length > 0) {
      buildCityDropdown();
    }
    
    // Add data based on current mode
    if (!state.geojsonLayer) return;
    
    if (mapMode === 'proportional') {
      createProportionalSymbols(data);
      // Also add to geojsonLayer for selection/restore functionality
      state.geojsonLayer.addData(data);
      if (state.map) {
        state.geojsonLayer.removeFrom(state.map); // Hide polygons, show circles
      }
    } else {
      state.geojsonLayer.addData(data);
    }
    
    // Fit bounds
    // Establish stable geographic bounds from polygon geometry only (circles can extend beyond)
    if (!state.baseDistrictBounds && state.geojsonLayer.getBounds && state.geojsonLayer.getBounds().isValid()) {
      state.baseDistrictBounds = state.geojsonLayer.getBounds();
    }
    
    // Check if city/precincts are in URL - if so, fit to those instead of all districts
    const hashParams = parseHashParams();
    let precinctIds: string[] = [];
    let boundsToFit: any = null;
    
    if (hashParams.city) {
      // Find precincts by matching city property
      // Normalize city name (converts snake_case to kebab-case)
      const normalizedCityName = normalizeCityName(hashParams.city);
      
      // Rewrite URL to kebab-case if it was snake_case
      if (hashParams.city !== normalizedCityName) {
        hashParams.city = normalizedCityName;
        const newHash = buildHashParams(hashParams);
        window.location.hash = newHash;
      }
      
      // Calculate bounds of precincts matching the city
      const selectedBounds = leaflet.latLngBounds([]);
      if (!state.geojsonLayer) return;
      state.geojsonLayer.eachLayer((layer: any) => {
        const feature = layer.feature;
        if (!feature) return;
        const props = feature.properties;
        const featureCity = safeGet<string | null>(props, 'city', null);
        
        // Get display city name (treats "Alameda County" as "Unincorporated Alameda County")
        const displayCity = getDisplayCityName(featureCity);
        
        const normalizedFeatureCity = normalizeCityName(displayCity);
        
        if (normalizedFeatureCity === normalizedCityName) {
          try {
            const tmp = leaflet.geoJSON(feature);
            const b = tmp.getBounds();
            if (b && b.isValid()) selectedBounds.extend(b);
          } catch (e) {}
        }
      });
      if (selectedBounds.isValid()) {
        boundsToFit = selectedBounds;
      }
    } else if (hashParams.precincts) {
      precinctIds = hashParams.precincts.split(/[+,]/);
      
      // Calculate bounds of selected precincts
      const selectedBounds = leaflet.latLngBounds([]);
      if (!state.geojsonLayer) return;
      state.geojsonLayer.eachLayer((layer: any) => {
        const feature = layer.feature;
        if (!feature) return;
        const props = feature.properties;
        const precinctId = getPrecinctId(props);
        const precinctIdStr = precinctId ? precinctId.toString() : null;
        if (precinctIdStr && precinctIds.indexOf(precinctIdStr) !== -1) {
          try {
            const tmp = leaflet.geoJSON(feature);
            const b = tmp.getBounds();
            if (b && b.isValid()) selectedBounds.extend(b);
          } catch (e) {}
        }
      });
      if (selectedBounds.isValid()) {
        boundsToFit = selectedBounds;
      }
    }
    
    // If no selected bounds, use all districts
    if (!boundsToFit) {
      boundsToFit = state.baseDistrictBounds || (state.geojsonLayer && state.geojsonLayer.getBounds && state.geojsonLayer.getBounds().isValid() ? state.geojsonLayer.getBounds() : null);
    }
    
    if (boundsToFit && state.map) {
      const isMobileInit = window.innerWidth <= 768;
      const bottomPanelInit = document.getElementById('bottom-panel');
      const bottomPaddingInit = bottomPanelInit ? bottomPanelInit.offsetHeight + (isMobileInit ? 140 : 80) : (isMobileInit ? 360 : 240);
      const sidePaddingInit = isMobileInit ? 50 : 80; // Mobile: zoomed out one more level, Desktop: unchanged
      const topPaddingInit = isMobileInit ? 50 : 80; // Mobile: zoomed out one more level, Desktop: unchanged
      state.map.fitBounds(boundsToFit, {
        paddingTopLeft: leaflet.point(sidePaddingInit, topPaddingInit),
        paddingBottomRight: leaflet.point(sidePaddingInit, bottomPaddingInit)
      });
      setTimeout(() => {
        applyMobileVerticalBias();
        applyDesktopDefaultBiasIfNeeded();
      }, 100);
    }
    
    // Update info section with county totals
    updateInfoSection(null);
    
    // Update button text based on initial mode
    const btn = document.getElementById('toggle-mode-btn');
    if (btn) {
      btn.textContent = mapMode === 'proportional' ? 'Mode – Proportional Districts' : 'Mode – Shaded Districts';
    }
    
    // Restore selection from URL if present (do this first to set currentCityName)
    restoreSelectionFromURL();
    
    // Update city button text after initial load
    updateCityButtonText();
    
    // Don't set initial hash - only update URL when user actually changes mode
    // This preserves URLs like #city/alameda without adding mode/shaded/
    
    // Listen for hash changes (back/forward navigation)
    if (!state.hashListenerBound) {
      window.addEventListener('hashchange', async () => {
        const hashParams = parseHashParams();
        const newMode = (hashParams.mode === 'proportional') ? 'proportional' : 'shaded';
        
        // Update mode if changed
        const { mapMode } = await import('./map-mode.js');
        if (newMode !== mapMode) {
          // Update mapMode in map-mode.ts
          // This will be handled by toggleMapMode
          toggleMapMode();
        }
        
        // Restore selection
        restoreSelectionFromURL();
      });
      state.hashListenerBound = true;
    }
  })
  .catch((error: Error) => {
    console.error('Error loading data:', error);
    alert('Error loading map data: ' + error.message + '\n\nMake sure precincts_consolidated.geojson and results.json are in the same directory as this HTML file and that you are accessing the page through a web server (not file://).');
  });
}

// Start initialization
initGeoJSONLayer();

