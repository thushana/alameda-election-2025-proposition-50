// ============================================================================
// STATE RESTORE
// ============================================================================
import L from 'leaflet';
import { state } from './state.js';
import { parseHashParams, buildHashParams, updateURL } from './url-manager.js';
import { normalizeCityName, denormalizeCityName, getDisplayCityName } from './city-helpers.js';
import { safeGet, getYesPercentage, getVoteCount, getPrecinctId } from './data-helpers.js';
import { setCircleStyle, setPolygonStyle, resetLayerStyle } from './map-styling.js';
import { updateAggregatedTotals } from './selection.js';
import { updateCityButtonText } from './ui-city-dropdown.js';
import { updateInfoSection } from './ui-info-section.js';
import { applyMobileVerticalBias } from './map-utils.js';
import { toggleMapMode } from './map-mode.js';
// Restore selection from URL on page load
export function restoreSelectionFromURL() {
    if (!state.geojsonLayer) {
        return;
    }
    // Guard against repeated identical calls
    const sigObj = parseHashParams();
    const sig = JSON.stringify(sigObj);
    if (state.restoreInProgress) {
        return;
    }
    if (sig === state.lastRestoreSignature) {
        return;
    }
    state.restoreInProgress = true;
    state.lastRestoreSignature = sig;
    // Clear existing selection first to prevent accumulation
    // Reset visual styles of previously selected precincts
    state.selectedPrecincts.forEach((item) => {
        if (item.layer && item.feature) {
            const props = item.feature.properties;
            const yesPct = getYesPercentage(props);
            resetLayerStyle(item.layer, yesPct);
        }
    });
    state.selectedPrecincts.length = 0;
    const hashParams = sigObj;
    // Check for city parameter first - find precincts by matching city property
    if (hashParams.city) {
        // Normalize city name (converts snake_case to kebab-case)
        const normalizedCityName = normalizeCityName(hashParams.city);
        state.currentCityName = denormalizeCityName(normalizedCityName);
        // Rewrite URL to kebab-case if it was snake_case
        if (hashParams.city !== normalizedCityName) {
            hashParams.city = normalizedCityName;
            const newHash = buildHashParams(hashParams);
            window.location.hash = newHash;
        }
        // Wait for layers to be populated
        setTimeout(async () => {
            const { mapMode, circleLayer } = await import('./map-mode.js');
            const layerSource = mapMode === 'proportional' && circleLayer ? circleLayer : state.geojsonLayer;
            if (!layerSource) {
                state.restoreInProgress = false;
                return;
            }
            // Find all precincts matching the city name
            layerSource.eachLayer((layer) => {
                const feature = layer.feature;
                if (!feature)
                    return;
                const props = feature.properties;
                const featureCity = safeGet(props, 'city', null);
                // Get display city name (treats "Alameda County" as "Unincorporated Alameda County")
                const displayCity = getDisplayCityName(featureCity);
                // Normalize both for comparison
                const normalizedFeatureCity = normalizeCityName(displayCity);
                if (normalizedFeatureCity === normalizedCityName) {
                    state.selectedPrecincts.push({ feature: feature, layer: layer });
                    // Set style with black border
                    const yesPct = getYesPercentage(props);
                    const isCircle = layer instanceof L.CircleMarker;
                    if (isCircle) {
                        const voteCount = getVoteCount(props);
                        setCircleStyle(layer, yesPct, voteCount, true);
                    }
                    else {
                        setPolygonStyle(layer, yesPct, true);
                    }
                    // Bring to front to ensure visibility
                    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                        layer.bringToFront();
                    }
                }
            });
            if (state.selectedPrecincts.length > 0) {
                updateAggregatedTotals();
                updateCityButtonText();
                // Fit bounds to selected city precincts
                const cityBounds = L.latLngBounds([]);
                state.selectedPrecincts.forEach((item) => {
                    const feature = item.feature;
                    if (feature && feature.geometry) {
                        try {
                            const tmp = L.geoJSON(feature);
                            const b = tmp.getBounds();
                            if (b && b.isValid()) {
                                cityBounds.extend(b);
                            }
                        }
                        catch (e) {
                            // Skip if bounds can't be calculated
                        }
                    }
                });
                if (cityBounds.isValid() && state.map) {
                    const isMobile = window.innerWidth <= 768;
                    const bottomPanel = document.getElementById('bottom-panel');
                    const bottomPadding = bottomPanel ? bottomPanel.offsetHeight + (isMobile ? 140 : 80) : (isMobile ? 360 : 240);
                    state.map.fitBounds(cityBounds, {
                        paddingTopLeft: L.point(20, 20),
                        paddingBottomRight: L.point(20, bottomPadding)
                    });
                    applyMobileVerticalBias();
                }
                state.restoreInProgress = false;
            }
            else {
                state.restoreInProgress = false;
            }
        }, 1000);
        return;
    }
    // Check for precincts in hash
    state.currentCityName = null;
    let precinctIds = [];
    if (hashParams.precincts) {
        // Handle both + and , for backwards compatibility
        precinctIds = hashParams.precincts.split(/[+,]/);
    }
    else {
        state.restoreInProgress = false;
        return;
    }
    if (precinctIds.length === 0) {
        state.restoreInProgress = false;
        return;
    }
    // Wait for layers to be populated
    setTimeout(async () => {
        const { mapMode, circleLayer } = await import('./map-mode.js');
        const layerSource = mapMode === 'proportional' && circleLayer ? circleLayer : state.geojsonLayer;
        if (!layerSource) {
            state.restoreInProgress = false;
            return;
        }
        layerSource.eachLayer((layer) => {
            const feature = layer.feature;
            if (!feature)
                return;
            const props = feature.properties;
            const precinctId = getPrecinctId(props);
            // Convert to string for comparison
            const precinctIdStr = precinctId ? precinctId.toString() : null;
            if (precinctIdStr && precinctIds.indexOf(precinctIdStr) !== -1) {
                state.selectedPrecincts.push({ feature: feature, layer: layer });
                // Set style with black border
                const yesPct = getYesPercentage(props);
                const isCircle = layer instanceof L.CircleMarker;
                if (isCircle) {
                    const voteCount = getVoteCount(props);
                    setCircleStyle(layer, yesPct, voteCount, true);
                }
                else {
                    setPolygonStyle(layer, yesPct, true);
                }
                // Bring to front to ensure visibility
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    layer.bringToFront();
                }
            }
        });
        if (state.selectedPrecincts.length > 0) {
            updateAggregatedTotals();
            updateCityButtonText();
            // Don't do fitBounds here - it was already done in initial load if city/precincts were in URL
            // Just restore the styling
            state.restoreInProgress = false;
        }
        else {
            state.restoreInProgress = false;
        }
    }, 1000);
}
// Clear selection on Escape, toggle map mode on 'M'
document.addEventListener('keydown', async (e) => {
    if (e.key === 'Escape' && state.selectedPrecincts.length > 0) {
        // Reset all selected precincts
        const { mapMode } = await import('./map-mode.js');
        state.selectedPrecincts.forEach((item) => {
            if (item.layer && item.feature) {
                const props = item.feature.properties;
                const yesPct = getYesPercentage(props);
                if (mapMode === 'shaded' && state.geojsonLayer) {
                    state.geojsonLayer.resetStyle(item.layer);
                }
                else {
                    // Reset circle style
                    if (item.layer.setStyle) {
                        const voteCount = getVoteCount(props);
                        setCircleStyle(item.layer, yesPct, voteCount, false);
                    }
                }
            }
        });
        state.selectedPrecincts.length = 0;
        state.currentCityName = null;
        updateURL();
        updateInfoSection(null);
    }
    else if (e.key === 'm' || e.key === 'M') {
        // Toggle map mode
        toggleMapMode();
    }
});
