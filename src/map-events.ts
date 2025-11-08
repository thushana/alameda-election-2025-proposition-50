// ============================================================================
// MAP EVENTS
// ============================================================================

import L, { type CircleMarker, type Layer } from 'leaflet';
import { COLORS, OPACITY } from './constants.js';
import { state } from './state.js';
import { getYesPercentage, getVoteCount } from './data-helpers.js';
import { setCircleStyle, setPolygonStyle, resetLayerStyle } from './map-styling.js';
import { updateInfoSection } from './ui-info-section.js';
import { updateAggregatedTotals } from './selection.js';
import { updateURL } from './url-manager.js';
import { updateCityButtonText } from './ui-city-dropdown.js';
import { getPrecinctId } from './data-helpers.js';
import { applyMobileVerticalBias } from './map-utils.js';
import type { GeoJSONFeature } from './types.js';

// Highlight on hover
export function highlightFeature(e: L.LeafletMouseEvent): void {
  const layer = e.target as Layer & { feature?: GeoJSONFeature; options?: any };
  const isCircle = layer instanceof L.CircleMarker;
  
  if (isCircle) {
    // For circles, increase size and opacity
    const currentRadius = (layer as CircleMarker).options.radius || 10;
    (layer as CircleMarker).setStyle({
      radius: currentRadius * 1.2,
      fillOpacity: 0.9,
      weight: 2
    });
  } else {
    // For polygons
    (layer as any).setStyle({
      weight: 3,
      color: COLORS.BORDER_HOVER,
      dashArray: '',
      fillOpacity: OPACITY.FILL_HOVER
    });
  }
  
  if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
    (layer as any).bringToFront();
  }
  if (layer.feature) {
    updateInfoSection(layer.feature.properties);
  }
}

// Reset highlight
export function resetHighlight(e: L.LeafletMouseEvent): void {
  const layer = e.target as Layer & { feature?: GeoJSONFeature };
  const isCircle = layer instanceof L.CircleMarker;
  
  // Check if this layer is selected - if so, keep the black border
  const isSelected = state.selectedPrecincts.some((item) => {
    return item.layer === layer;
  });
  
  const props = layer.feature ? layer.feature.properties : {};
  const yesPct = getYesPercentage(props);
  
  if (isSelected) {
    // Keep selected style
    if (isCircle) {
      const voteCount = getVoteCount(props);
      setCircleStyle(layer as CircleMarker, yesPct, voteCount, true);
    } else {
      setPolygonStyle(layer, yesPct, true);
    }
  } else {
    if (isCircle) {
      const voteCount = getVoteCount(props);
      setCircleStyle(layer as CircleMarker, yesPct, voteCount, false);
    } else if (state.geojsonLayer) {
      state.geojsonLayer.resetStyle(layer);
    }
  }
  
  // If precincts are selected, show aggregated totals; otherwise show county totals
  if (state.selectedPrecincts.length > 0) {
    updateAggregatedTotals();
  } else {
    updateInfoSection(null);
  }
}

// Zoom to feature on click
export function zoomToFeature(e: L.LeafletMouseEvent): void {
  const target = e.target as Layer & { feature?: GeoJSONFeature; getBounds?: () => L.LatLngBounds; getLatLng?: () => L.LatLng };
  const feature = target && target.feature;
  
  if (!state.map) return;
  
  // Update URL to show this single precinct
  if (feature && feature.properties) {
    const props = feature.properties;
    const precinctId = getPrecinctId(props);
    
    if (precinctId) {
      // Clear existing selection and set to just this precinct
      state.selectedPrecincts.forEach((item) => {
        if (item.layer && item.feature) {
          const itemProps = item.feature.properties;
          const itemYesPct = getYesPercentage(itemProps);
          resetLayerStyle(item.layer, itemYesPct);
        }
      });
      
      // Clear city selection when clicking individual precinct
      state.currentCityName = null;
      
      // Select just this precinct
      state.selectedPrecincts.length = 0;
      state.selectedPrecincts.push({ feature: feature, layer: target });
      const yesPct = getYesPercentage(props);
      const isCircle = target instanceof L.CircleMarker;
      
      if (isCircle) {
        const voteCount = getVoteCount(props);
        setCircleStyle(target as CircleMarker, yesPct, voteCount, true);
      } else {
        setPolygonStyle(target, yesPct, true);
      }
      
      // Bring to front
      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        (target as any).bringToFront();
      }
      
      // Update city button text
      updateCityButtonText();
      
      // Update URL and aggregated totals
      updateURL();
      updateAggregatedTotals();
    }
  }
  
      // Always derive bounds from the polygon geometry when available
  if (feature && feature.geometry && state.map) {
    try {
      const tmpLayer = L.geoJSON(feature);
      const bounds = tmpLayer.getBounds();
      if (bounds && bounds.isValid()) {
        const isMobile = window.innerWidth <= 768;
        const bottomPanel = document.getElementById('bottom-panel');
        const bottomPadding = bottomPanel ? bottomPanel.offsetHeight + (isMobile ? 140 : 80) : (isMobile ? 360 : 240);
        state.map.fitBounds(bounds, {
          paddingTopLeft: L.point(20, 20),
          paddingBottomRight: L.point(20, bottomPadding)
        });
        applyMobileVerticalBias();
        return;
      }
    } catch (err) {
      // fall through to other strategies
    }
  }
  // Fallbacks only if geometry bounds cannot be computed
  if (target && state.map) {
    if (typeof (target as any).getBounds === 'function') {
      const isMobileFB = window.innerWidth <= 768;
      const bottomPanelFB = document.getElementById('bottom-panel');
      const bottomPaddingFB = bottomPanelFB ? bottomPanelFB.offsetHeight + (isMobileFB ? 140 : 80) : (isMobileFB ? 360 : 240);
      state.map.fitBounds((target as any).getBounds(), {
        paddingTopLeft: L.point(20, 20),
        paddingBottomRight: L.point(20, bottomPaddingFB)
      });
      applyMobileVerticalBias();
    } else if (typeof (target as any).getLatLng === 'function') {
      state.map.setView((target as any).getLatLng());
    }
  }
}

// Toggle precinct selection on command-click or option-click
export function togglePrecinctSelection(e: L.LeafletMouseEvent): void {
  if (e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey) {
    e.originalEvent.preventDefault();
    const feature = (e.target as any).feature as GeoJSONFeature;
    const layer = e.target as Layer;
    
    if (!feature || !state.geojsonLayer) return;
    
    // Clear city name when manually selecting
    state.currentCityName = null;
    
    // Check if already selected
    const index = state.selectedPrecincts.findIndex((p) => {
      return p.feature === feature;
    });
    
    const props = feature.properties;
    const yesPct = getYesPercentage(props);
    const isCircle = layer instanceof L.CircleMarker;
    
    if (index === -1) {
      // Add to selection
      state.selectedPrecincts.push({ feature: feature, layer: layer });
      
      if (isCircle) {
        const voteCount = getVoteCount(props);
        setCircleStyle(layer as CircleMarker, yesPct, voteCount, true);
      } else {
        setPolygonStyle(layer, yesPct, true);
      }
      
      // Bring to front to ensure visibility
      if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        (layer as any).bringToFront();
      }
    } else {
      // Remove from selection
      state.selectedPrecincts.splice(index, 1);
      
      if (isCircle) {
        const voteCount = getVoteCount(props);
        setCircleStyle(layer as CircleMarker, yesPct, voteCount, false);
      } else {
        state.geojsonLayer.resetStyle(layer);
      }
    }
    
    // Update URL with selected precincts
    updateURL();
    
    // Update aggregated totals
    updateAggregatedTotals();
  } else {
    // Normal click - zoom and update URL
    zoomToFeature(e);
  }
}

// Add event listeners
export function onEachFeature(_feature: any, layer: any): void {
  (layer as any).on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: togglePrecinctSelection
  });
}

