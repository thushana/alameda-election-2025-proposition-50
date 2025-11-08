// ============================================================================
// MAP EVENTS
// ============================================================================

// Highlight on hover
function highlightFeature(e) {
    var layer = e.target;
    var isCircle = layer instanceof L.CircleMarker;
    
    if (isCircle) {
        // For circles, increase size and opacity
        var currentRadius = layer.options.radius || 10;
        layer.setStyle({
            radius: currentRadius * 1.2,
            fillOpacity: 0.9,
            weight: 2
        });
    } else {
        // For polygons
        layer.setStyle({
            weight: 3,
            color: COLORS.BORDER_HOVER,
            dashArray: '',
            fillOpacity: OPACITY.FILL_HOVER
        });
    }
    
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
    updateInfoSection(layer.feature.properties);
}

// Reset highlight
function resetHighlight(e) {
    var layer = e.target;
    var isCircle = layer instanceof L.CircleMarker;
    
    // Check if this layer is selected - if so, keep the black border
    var isSelected = selectedPrecincts.some(function(item) {
        return item.layer === layer;
    });
    
    var props = layer.feature ? layer.feature.properties : {};
    var yesPct = getYesPercentage(props);
    
    if (isSelected) {
        // Keep selected style
        if (isCircle) {
            var voteCount = getVoteCount(props);
            setCircleStyle(layer, yesPct, voteCount, true);
        } else {
            setPolygonStyle(layer, yesPct, true);
        }
    } else {
        if (isCircle) {
            var voteCount = getVoteCount(props);
            setCircleStyle(layer, yesPct, voteCount, false);
        } else {
            geojsonLayer.resetStyle(layer);
        }
    }
    
    // If precincts are selected, show aggregated totals; otherwise show county totals
    if (selectedPrecincts.length > 0) {
        updateAggregatedTotals();
    } else {
        updateInfoSection(null);
    }
}

// Zoom to feature on click
function zoomToFeature(e) {
    var target = e.target;
    var feature = target && target.feature;
    
    // Update URL to show this single precinct
    if (feature && feature.properties) {
        var props = feature.properties;
        var precinctId = getPrecinctId(props);
        
        if (precinctId) {
            // Clear existing selection and set to just this precinct
            selectedPrecincts.forEach(function(item) {
                if (item.layer && item.feature) {
                    var itemProps = item.feature.properties;
                    var itemYesPct = getYesPercentage(itemProps);
                    resetLayerStyle(item.layer, itemYesPct);
                }
            });
            
            // Clear city selection when clicking individual precinct
            currentCityName = null;
            
            // Select just this precinct
            selectedPrecincts = [{ feature: feature, layer: target }];
            var yesPct = getYesPercentage(props);
            var isCircle = target instanceof L.CircleMarker;
            
            if (isCircle) {
                var voteCount = getVoteCount(props);
                setCircleStyle(target, yesPct, voteCount, true);
            } else {
                setPolygonStyle(target, yesPct, true);
            }
            
            // Bring to front
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                target.bringToFront();
            }
            
            // Update city button text
            updateCityButtonText();
            
            // Update URL and aggregated totals
            updateURL();
            updateAggregatedTotals();
        }
    }
    
    // Always derive bounds from the polygon geometry when available
    if (feature && feature.geometry) {
        try {
            var tmpLayer = L.geoJSON(feature);
            var bounds = tmpLayer.getBounds();
            if (bounds && bounds.isValid()) {
                var isMobile = window.innerWidth <= 768;
                var bottomPanel = document.getElementById('bottom-panel');
                var bottomPadding = bottomPanel ? bottomPanel.offsetHeight + (isMobile ? 140 : 80) : (isMobile ? 360 : 240);
                map.fitBounds(bounds, {
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
    if (target && typeof target.getBounds === 'function') {
        var isMobileFB = window.innerWidth <= 768;
        var bottomPanelFB = document.getElementById('bottom-panel');
        var bottomPaddingFB = bottomPanelFB ? bottomPanelFB.offsetHeight + (isMobileFB ? 140 : 80) : (isMobileFB ? 360 : 240);
        map.fitBounds(target.getBounds(), {
            paddingTopLeft: L.point(20, 20),
            paddingBottomRight: L.point(20, bottomPaddingFB)
        });
        applyMobileVerticalBias();
    } else if (target && typeof target.getLatLng === 'function') {
        map.setView(target.getLatLng());
    }
}

// Toggle precinct selection on command-click or option-click
function togglePrecinctSelection(e) {
    if (e.originalEvent.metaKey || e.originalEvent.ctrlKey || e.originalEvent.altKey) {
        e.originalEvent.preventDefault();
        var feature = e.target.feature;
        var layer = e.target;
        
        // Clear city name when manually selecting
        currentCityName = null;
        
        // Check if already selected
        var index = selectedPrecincts.findIndex(function(p) {
            return p.feature === feature;
        });
        
        var props = feature.properties;
        var yesPct = getYesPercentage(props);
        var isCircle = layer instanceof L.CircleMarker;
        
        if (index === -1) {
            // Add to selection
            selectedPrecincts.push({ feature: feature, layer: layer });
            
            if (isCircle) {
                var voteCount = getVoteCount(props);
                setCircleStyle(layer, yesPct, voteCount, true);
            } else {
                setPolygonStyle(layer, yesPct, true);
            }
            
            // Bring to front to ensure visibility
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }
        } else {
            // Remove from selection
            selectedPrecincts.splice(index, 1);
            
            if (isCircle) {
                var voteCount = getVoteCount(props);
                setCircleStyle(layer, yesPct, voteCount, false);
            } else {
                geojsonLayer.resetStyle(layer);
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
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: togglePrecinctSelection
    });
}

