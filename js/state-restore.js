// ============================================================================
// STATE RESTORE
// ============================================================================

// Restore selection from URL on page load
function restoreSelectionFromURL() {
    if (!geojsonLayer) {
        return;
    }
    // Guard against repeated identical calls
    var sigObj = parseHashParams();
    var sig = JSON.stringify(sigObj);
    if (restoreInProgress) {
        return;
    }
    if (sig === lastRestoreSignature) {
        return;
    }
    restoreInProgress = true;
    lastRestoreSignature = sig;
    
    // Clear existing selection first to prevent accumulation
    // Reset visual styles of previously selected precincts
    selectedPrecincts.forEach(function(item) {
        if (item.layer && item.feature) {
            var props = item.feature.properties;
            var yesPct = getYesPercentage(props);
            resetLayerStyle(item.layer, yesPct);
        }
    });
    
    selectedPrecincts = [];
    
    var hashParams = sigObj;
    
    // Check for city parameter first - find precincts by matching city property
    if (hashParams.city) {
        // Normalize city name (converts snake_case to kebab-case)
        var normalizedCityName = normalizeCityName(hashParams.city);
        currentCityName = denormalizeCityName(normalizedCityName);
        
        // Rewrite URL to kebab-case if it was snake_case
        if (hashParams.city !== normalizedCityName) {
            hashParams.city = normalizedCityName;
            var newHash = buildHashParams(hashParams);
            window.location.hash = newHash;
        }
        
        // Wait for layers to be populated
        setTimeout(function() {
            var layerSource = mapMode === 'proportional' && circleLayer ? circleLayer : geojsonLayer;
            
            if (!layerSource) {
                restoreInProgress = false;
                return;
            }
            
            // Find all precincts matching the city name
            layerSource.eachLayer(function(layer) {
                var feature = layer.feature;
                if (!feature) return;
                
                var props = feature.properties;
                var featureCity = safeGet(props, 'city', null);
                
                // Get display city name (treats "Alameda County" as "Unincorporated Alameda County")
                var displayCity = getDisplayCityName(featureCity);
                
                // Normalize both for comparison
                var normalizedFeatureCity = normalizeCityName(displayCity);
                
                if (normalizedFeatureCity === normalizedCityName) {
                    selectedPrecincts.push({ feature: feature, layer: layer });
                    
                    // Set style with black border
                    var yesPct = getYesPercentage(props);
                    var isCircle = layer instanceof L.CircleMarker;
                    
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
                }
            });
            
            if (selectedPrecincts.length > 0) {
                updateAggregatedTotals();
                updateCityButtonText();
                
                // Fit bounds to selected city precincts
                var cityBounds = L.latLngBounds([]);
                selectedPrecincts.forEach(function(item) {
                    var feature = item.feature;
                    if (feature && feature.geometry) {
                        try {
                            var tmp = L.geoJSON(feature);
                            var b = tmp.getBounds();
                            if (b && b.isValid()) {
                                cityBounds.extend(b);
                            }
                        } catch (e) {
                            // Skip if bounds can't be calculated
                        }
                    }
                });
                
                if (cityBounds.isValid()) {
                    var isMobile = window.innerWidth <= 768;
                    var bottomPanel = document.getElementById('bottom-panel');
                    var bottomPadding = bottomPanel ? bottomPanel.offsetHeight + (isMobile ? 140 : 80) : (isMobile ? 360 : 240);
                    map.fitBounds(cityBounds, {
                        paddingTopLeft: L.point(20, 20),
                        paddingBottomRight: L.point(20, bottomPadding)
                    });
                    applyMobileVerticalBias();
                }
                
                restoreInProgress = false;
            } else {
                restoreInProgress = false;
            }
        }, 1000);
        return;
    }
    
    // Check for precincts in hash
    currentCityName = null;
    var precinctIds = [];
    if (hashParams.precincts) {
        // Handle both + and , for backwards compatibility
        precinctIds = hashParams.precincts.split(/[+,]/);
    } else {
        restoreInProgress = false;
        return;
    }
    
    if (precinctIds.length === 0) {
        restoreInProgress = false;
        return;
    }
    
    // Wait for layers to be populated
    setTimeout(function() {
        var layerSource = mapMode === 'proportional' && circleLayer ? circleLayer : geojsonLayer;
        
        if (!layerSource) {
            restoreInProgress = false;
            return;
        }
        
        layerSource.eachLayer(function(layer) {
            var feature = layer.feature;
            if (!feature) return;
            
            var props = feature.properties;
            var precinctId = getPrecinctId(props);
            
            // Convert to string for comparison
            var precinctIdStr = precinctId ? precinctId.toString() : null;
            
            if (precinctIdStr && precinctIds.indexOf(precinctIdStr) !== -1) {
                selectedPrecincts.push({ feature: feature, layer: layer });
                
                // Set style with black border
                var yesPct = getYesPercentage(props);
                var isCircle = layer instanceof L.CircleMarker;
                
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
            }
        });
        
        
        if (selectedPrecincts.length > 0) {
            updateAggregatedTotals();
            updateCityButtonText();
            // Don't do fitBounds here - it was already done in initial load if city/precincts were in URL
            // Just restore the styling
            restoreInProgress = false;
        } else {
            restoreInProgress = false;
        }
    }, 1000);
}

// Clear selection on Escape, toggle map mode on 'M'
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && selectedPrecincts.length > 0) {
        // Reset all selected precincts
        selectedPrecincts.forEach(function(item) {
            if (item.layer && item.feature) {
                var props = item.feature.properties;
                var yesPct = getYesPercentage(props);
                
                if (mapMode === 'shaded') {
                    geojsonLayer.resetStyle(item.layer);
                } else {
                    // Reset circle style
                    if (item.layer.setStyle) {
                        var voteCount = getVoteCount(props);
                        setCircleStyle(item.layer, yesPct, voteCount, false);
                    }
                }
            }
        });
        selectedPrecincts = [];
        currentCityName = null;
        updateURL();
        updateInfoSection(null);
    } else if (e.key === 'm' || e.key === 'M') {
        // Toggle map mode
        toggleMapMode();
    }
});

