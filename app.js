// ============================================================================
// CONSTANTS
// ============================================================================

// Colors
var COLORS = {
    // Map colors
    NO_DATA: '#d3d3d3',
    RED_SHADE: '#fc9272',
    GREEN_100: '#006d2c',
    GREEN_95: '#238b45',
    GREEN_90: '#41ab5d',
    GREEN_85: '#74c476',
    GREEN_80: '#a1d99b',
    GREEN_75: '#c7e9c0',
    GREEN_50: '#d4e8d0',
    BORDER_NO_DATA: '#999999',
    BORDER_DEFAULT: 'white',
    BORDER_HOVER: '#666',
    BORDER_SELECTED: '#000000',
    
    // Bar graph colors
    YES: '#41ab5d',
    NO: '#e74c3c',
    METHOD_MAIL_IN: '#78909C',
    METHOD_IN_PERSON: '#CFD8DC'
};

// Sizes and spacing
var SIZES = {
    BAR_GRAPH_HEIGHT: '12px',
    BAR_GRAPH_BORDER_RADIUS: '6px',
    // Typography sizes (standardized to 4 sizes)
    FONT_LARGE: '24px',      // Main titles, precinct names, large percentages
    FONT_MEDIUM: '16px',     // Section headers, important labels
    FONT_SMALL: '14px',      // Body text, data columns, buttons, vote method percentages
    FONT_XSMALL: '12px',     // Labels, secondary text, vote method labels
    MARGIN_BOTTOM_SMALL: '2px',
    MARGIN_BOTTOM_MEDIUM: '12px',
    MARGIN_TOP_SECTION: '16px'
};

// Opacity values
var OPACITY = {
    FILL_DEFAULT: 0.7,
    FILL_HOVER: 0.9,
    FILL_SELECTED: 0.8,
    BACKGROUND_LIGHT: 'rgba(0, 0, 0, 0.1)',
    TEXT_PRIMARY: 'rgba(0, 0, 0, 0.87)',
    TEXT_SECONDARY: 'rgba(0, 0, 0, 0.6)',
    BORDER_LIGHT: 'rgba(0, 0, 0, 0.12)'
};

// ============================================================================
// MAP INITIALIZATION
// ============================================================================

// Initialize map centered on Alameda County
var map = L.map('map', { zoomControl: false }).setView([37.8044, -122.2712], 10);

// Add CartoDB Positron (Light) tile layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Color scale for YES percentage
// 0-50% as red shades, 50-100% as green shades
function getColor(yesPct) {
    if (yesPct === null || yesPct === undefined || yesPct === 0) {
        return COLORS.NO_DATA;
    }
    // 1-50% as single red shade
    if (yesPct <= 50) {
        return COLORS.RED_SHADE;
    }
    // Split 50-100% into 6 green steps
    return yesPct >= 100 ? COLORS.GREEN_100 :
           yesPct >= 95 ? COLORS.GREEN_95 :
           yesPct >= 90 ? COLORS.GREEN_90 :
           yesPct >= 85 ? COLORS.GREEN_85 :
           yesPct >= 80 ? COLORS.GREEN_80 :
           yesPct >= 75 ? COLORS.GREEN_75 :
           COLORS.GREEN_50;
}

// Style function
function style(feature) {
    var props = feature.properties;
    var yesPct = (props.percentage && props.percentage.yes !== undefined) ? props.percentage.yes : null;
    return {
        fillColor: getColor(yesPct),
        weight: 1,
        opacity: 1,
        color: yesPct === null ? COLORS.BORDER_NO_DATA : COLORS.BORDER_DEFAULT,
        dashArray: yesPct === null ? '5,5' : '3',
        fillOpacity: OPACITY.FILL_DEFAULT
    };
}

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
    
    if (isSelected) {
        // Keep selected style
        var yesPct = layer.feature.properties.percentage ? layer.feature.properties.percentage.yes : null;
        
        if (isCircle) {
            // For circles, keep black border
            var voteCount = (layer.feature && layer.feature.properties && layer.feature.properties.votes) ? layer.feature.properties.votes.total : 0;
            layer.setStyle({
                radius: getCircleRadius(voteCount),
                fillColor: getColor(yesPct),
                color: COLORS.BORDER_SELECTED,
                weight: 3,
                fillOpacity: OPACITY.FILL_SELECTED
            });
        } else {
            // For polygons
            layer.setStyle({
                weight: 4,
                color: COLORS.BORDER_SELECTED,
                fillOpacity: OPACITY.FILL_SELECTED,
                dashArray: '',
                fillColor: getColor(yesPct)
            });
        }
    } else {
        if (isCircle) {
            // Reset circle to original style
            var yesPct = layer.feature.properties.percentage ? layer.feature.properties.percentage.yes : null;
            var voteCount = layer.feature.properties.votes ? layer.feature.properties.votes.total : 0;
            layer.setStyle({
                radius: getCircleRadius(voteCount),
                fillColor: getColor(yesPct),
                color: '#fff',
                weight: 1,
                fillOpacity: 0.7
            });
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

// Selected precincts for aggregation
var selectedPrecincts = [];
var isSelectionMode = false;
var currentCityName = null;
var voteMethodSectionExpanded = false;
// Stable geographic bounds derived from precinct polygons (never circles)
var baseDistrictBounds = null;

// Hash-based URL parsing and building (works with static file servers)
function parseHashParams() {
    var hash = window.location.hash;
    if (!hash || hash.length <= 1) {
        return { mode: null, city: null, precincts: null };
    }
    
    // Remove # from hash, handle both #/mode/... and #mode/...
    var path = hash.substring(1);
    // Remove leading slash if present
    if (path.charAt(0) === '/') {
        path = path.substring(1);
    }
    var parts = path.split('/').filter(function(p) { return p.length > 0; });
    var params = {
        mode: null,
        city: null,
        precincts: null
    };
    
    // Mode synonyms: choropleth -> shaded, bubble -> proportional
    function normalizeMode(mode) {
        if (!mode) return null;
        mode = mode.toLowerCase();
        if (mode === 'choropleth') return 'shaded';
        if (mode === 'bubble' || mode === 'bubbles') return 'proportional';
        return mode; // Return as-is if not a synonym
    }
    
    for (var i = 0; i < parts.length; i++) {
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

function buildHashParams(params) {
    var pathParts = [];
    
    // Always include mode
    if (params.mode) {
        pathParts.push('mode', params.mode);
    } else {
        pathParts.push('mode', 'shaded'); // Default
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

// Map visualization mode: 'shaded' or 'proportional'
// Read from URL hash if present, default to 'shaded'
var hashParams = parseHashParams();
var mapMode = (hashParams.mode === 'proportional') ? 'proportional' : 'shaded';
var circleLayer = null;
var maxVotes = 0; // Will be calculated from data

// Calculate circle radius based on vote count
function getCircleRadius(voteCount) {
    if (!voteCount || voteCount === 0 || maxVotes === 0) {
        return 2; // Minimum radius
    }
    // Scale from 2px to 30px based on vote count
    var minRadius = 2;
    var maxRadius = 30;
    var ratio = voteCount / maxVotes;
    return minRadius + (maxRadius - minRadius) * Math.sqrt(ratio); // Use sqrt for better visual scaling
}

// Get centroid of a feature
function getCentroid(feature) {
    // Use Leaflet's built-in method if available, otherwise calculate manually
    if (feature.geometry && feature.geometry.coordinates) {
        var coords = feature.geometry.coordinates;
        var lng = 0, lat = 0, count = 0;
        
        function processCoordinates(coords) {
            if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
                // Array of coordinates
                coords.forEach(function(coord) {
                    if (Array.isArray(coord[0])) {
                        processCoordinates(coord);
                    } else {
                        // GeoJSON format: [lng, lat]
                        lng += coord[0];
                        lat += coord[1];
                        count++;
                    }
                });
            } else if (typeof coords[0] === 'number') {
                // Single coordinate [lng, lat]
                lng += coords[0];
                lat += coords[1];
                count++;
            }
        }
        
        if (feature.geometry.type === 'Polygon') {
            processCoordinates(coords[0]); // Use outer ring
        } else if (feature.geometry.type === 'MultiPolygon') {
            coords.forEach(function(polygon) {
                processCoordinates(polygon[0]); // Use outer ring of each polygon
            });
        }
        
        // Return as [lat, lng] for Leaflet
        return count > 0 ? [lat / count, lng / count] : null;
    }
    return null;
}

// Create proportional symbol circles
function createProportionalSymbols(data) {
    // Remove existing circle layer
    if (circleLayer) {
        map.removeLayer(circleLayer);
    }
    
    // Calculate max votes for scaling
    maxVotes = 0;
    data.features.forEach(function(feature) {
        if (feature.properties && feature.properties.votes && feature.properties.votes.total) {
            maxVotes = Math.max(maxVotes, feature.properties.votes.total);
        }
    });
    
    // Create circle markers
    var circles = [];
    data.features.forEach(function(feature) {
        var props = feature.properties;
        var votes = props.votes || {};
        var voteCount = votes.total || 0;
        var yesPct = props.percentage && props.percentage.yes !== undefined ? props.percentage.yes : null;
        
        var centroid = getCentroid(feature);
        if (centroid && voteCount > 0) {
            var radius = getCircleRadius(voteCount);
            var color = getColor(yesPct);
            
            var circle = L.circleMarker([centroid[0], centroid[1]], {
                radius: radius,
                fillColor: color,
                color: '#fff',
                weight: 1,
                opacity: 0.8,
                fillOpacity: 0.7
            });
            
            // Store feature properties for hover/click
            circle.feature = feature;
            
            // Add event listeners
            circle.on({
                mouseover: highlightFeature,
                mouseout: resetHighlight,
                click: togglePrecinctSelection
            });
            
            circles.push(circle);
        }
    });
    
    circleLayer = L.layerGroup(circles).addTo(map);
}

// Toggle map mode
function toggleMapMode() {
    // Toggle the mode
    mapMode = mapMode === 'shaded' ? 'proportional' : 'shaded';
    
    // Update URL parameter
    updateModeURL();
    
    // Update button text to show current mode
    var btn = document.getElementById('toggle-mode-btn');
    if (btn) {
        btn.textContent = mapMode === 'proportional' ? 'Mode – Proportional Districts' : 'Mode – Shaded Districts';
    }
    
    if (mapMode === 'proportional') {
        // Hide polygon layer, show circles
        if (geojsonLayer) {
            map.removeLayer(geojsonLayer);
        }
        // Circles will be created when data loads
    } else {
        // Hide circles, show polygon layer (shaded mode)
        if (circleLayer) {
            map.removeLayer(circleLayer);
        }
        if (geojsonLayer) {
            map.addLayer(geojsonLayer);
        }
    }
    
    // Reload data to apply mode
    if (geojsonLayer && geojsonLayer.getLayers().length > 0) {
        // Get current data and recreate visualization
        var currentData = { features: [] };
        geojsonLayer.eachLayer(function(layer) {
            if (layer.feature) {
                currentData.features.push(layer.feature);
            }
        });
        
        if (mapMode === 'proportional') {
            createProportionalSymbols(currentData);
        } else {
            geojsonLayer.addTo(map);
        }
    }
}

// Make toggleMapMode globally accessible
window.toggleMapMode = toggleMapMode;

// Toggle precinct selection on command-click
function togglePrecinctSelection(e) {
    if (e.originalEvent.metaKey || e.originalEvent.ctrlKey) {
        e.originalEvent.preventDefault();
        isSelectionMode = true;
        var feature = e.target.feature;
        var layer = e.target;
        
        // Clear city name when manually selecting
        currentCityName = null;
        
        // Check if already selected
        var index = selectedPrecincts.findIndex(function(p) {
            return p.feature === feature;
        });
        
        if (index === -1) {
            // Add to selection
            selectedPrecincts.push({ feature: feature, layer: layer });
            var yesPct = feature.properties.percentage ? feature.properties.percentage.yes : null;
            var isCircle = layer instanceof L.CircleMarker;
            
            if (isCircle) {
                // For circles, add black border
                var voteCount = feature.properties.votes ? feature.properties.votes.total : 0;
                layer.setStyle({
                    radius: getCircleRadius(voteCount),
                    fillColor: getColor(yesPct),
                    color: '#000000',
                    weight: 3,
                    fillOpacity: 0.8
                });
            } else {
                // For polygons
                layer.setStyle({
                    weight: 4,
                    color: '#000000',
                    fillOpacity: 0.8,
                    dashArray: '',
                    fillColor: getColor(yesPct)
                });
            }
            
            // Bring to front to ensure visibility
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }
        } else {
            // Remove from selection
            selectedPrecincts.splice(index, 1);
            var isCircle = layer instanceof L.CircleMarker;
            
            if (isCircle) {
                // Reset circle to original style
                var yesPct = feature.properties.percentage ? feature.properties.percentage.yes : null;
                var voteCount = feature.properties.votes ? feature.properties.votes.total : 0;
                layer.setStyle({
                    radius: getCircleRadius(voteCount),
                    fillColor: getColor(yesPct),
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.7
                });
            } else {
                geojsonLayer.resetStyle(layer);
            }
        }
        
        // Update URL with selected precincts
        updateURL();
        
        // Update aggregated totals
        updateAggregatedTotals();
    } else {
        // Normal click - zoom
        zoomToFeature(e);
    }
}

// Calculate and display aggregated totals
function updateAggregatedTotals() {
    if (selectedPrecincts.length === 0) {
        updateInfoSection(null);
        return;
    }
    
    var aggregated = {
        yes: 0,
        no: 0,
        total: 0,
        count: selectedPrecincts.length
    };
    
    // Aggregate vote_method data
    var mailInAggregated = {
        yes: 0,
        no: 0,
        total: 0
    };
    var inPersonAggregated = {
        yes: 0,
        no: 0,
        total: 0
    };
    
    selectedPrecincts.forEach(function(item) {
        var props = item.feature.properties;
        if (props.votes) {
            if (props.votes.yes) aggregated.yes += props.votes.yes;
            if (props.votes.no) aggregated.no += props.votes.no;
            if (props.votes.total) aggregated.total += props.votes.total;
        }
        
        // Aggregate vote_method data
        if (props.vote_method) {
            if (props.vote_method.mail_in && props.vote_method.mail_in.votes) {
                var mailIn = props.vote_method.mail_in.votes;
                if (mailIn.yes) mailInAggregated.yes += mailIn.yes;
                if (mailIn.no) mailInAggregated.no += mailIn.no;
                if (mailIn.total) mailInAggregated.total += mailIn.total;
            }
            if (props.vote_method.in_person && props.vote_method.in_person.votes) {
                var inPerson = props.vote_method.in_person.votes;
                if (inPerson.yes) inPersonAggregated.yes += inPerson.yes;
                if (inPerson.no) inPersonAggregated.no += inPerson.no;
                if (inPerson.total) inPersonAggregated.total += inPerson.total;
            }
        }
    });
    
    // Calculate percentages
    if (aggregated.total > 0) {
        aggregated.yesPct = (aggregated.yes / aggregated.total) * 100;
        aggregated.noPct = (aggregated.no / aggregated.total) * 100;
    } else {
        aggregated.yesPct = 0;
        aggregated.noPct = 0;
    }
    
    // Calculate vote_method percentages
    var voteMethod = null;
    if (mailInAggregated.total > 0 || inPersonAggregated.total > 0) {
        voteMethod = {
            mail_in: {
                votes: mailInAggregated,
                percentage: {
                    yes: mailInAggregated.total > 0 ? (mailInAggregated.yes / mailInAggregated.total) * 100 : 0,
                    no: mailInAggregated.total > 0 ? (mailInAggregated.no / mailInAggregated.total) * 100 : 0
                },
                percentage_of_total: aggregated.total > 0 ? (mailInAggregated.total / aggregated.total) * 100 : 0
            },
            in_person: {
                votes: inPersonAggregated,
                percentage: {
                    yes: inPersonAggregated.total > 0 ? (inPersonAggregated.yes / inPersonAggregated.total) * 100 : 0,
                    no: inPersonAggregated.total > 0 ? (inPersonAggregated.no / inPersonAggregated.total) * 100 : 0
                },
                percentage_of_total: aggregated.total > 0 ? (inPersonAggregated.total / aggregated.total) * 100 : 0
            }
        };
    }
    
    // Create aggregated properties object
    var aggregatedProps = {
        aggregated: true,
        count: aggregated.count,
        cityName: currentCityName,
        votes: {
            yes: aggregated.yes,
            no: aggregated.no,
            total: aggregated.total
        },
        percentage: {
            yes: aggregated.yesPct,
            no: aggregated.noPct
        }
    };
    
    // Add vote_method if available
    if (voteMethod) {
        aggregatedProps.vote_method = voteMethod;
    }
    
    updateInfoSection(aggregatedProps);
}

// Update URL with map mode parameter
function updateModeURL() {
    var hashParams = parseHashParams();
    hashParams.mode = mapMode;
    
    // Preserve city from URL if it exists, or use currentCityName
    if (hashParams.city) {
        // Keep city from URL
    } else if (currentCityName) {
        hashParams.city = currentCityName;
    }
    
    // Preserve precincts from URL if they exist, or use selectedPrecincts
    if (hashParams.precincts) {
        // Keep precincts from URL
    } else if (selectedPrecincts.length > 0) {
        var precinctIds = selectedPrecincts.map(function(item) {
            var props = item.feature.properties;
            return props.Precinct_ID || 
                   props['Precinct_ID'] || 
                   props.precinct || 
                   props['precinct'] ||
                   props.ID || 
                   props['ID'] || 
                   'N/A';
        }).join('+');
        if (precinctIds) {
            hashParams.precincts = precinctIds;
        }
    }
    
    // Don't remove city or precincts that are in the URL - preserve them
    // Only remove precincts if they're not in the URL and not selected
    // (City from URL will be handled by restoreSelectionFromURL)
    
    var newHash = buildHashParams(hashParams);
    window.location.hash = newHash;
}

// Update URL with selected precinct numbers
function updateURL() {
    var hashParams = parseHashParams();
    
    // Preserve mode
    hashParams.mode = mapMode;
    
    // Get precinct IDs
    var precinctIds = selectedPrecincts.map(function(item) {
        var props = item.feature.properties;
        return props.Precinct_ID || 
               props['Precinct_ID'] || 
               props.precinct || 
               props['precinct'] ||
               props.ID || 
               props['ID'] || 
               'N/A';
    }).join('+');
    
    if (precinctIds && selectedPrecincts.length > 0) {
        hashParams.precincts = precinctIds;
        // Clear city when manually selecting precincts
        if (hashParams.city && !currentCityName) {
            delete hashParams.city;
        }
    } else {
        delete hashParams.precincts;
    }
    
    // Preserve city if it exists
    if (currentCityName) {
        hashParams.city = currentCityName;
    } else if (!currentCityName && hashParams.city) {
        // Keep city if it was in URL but not cleared
    }
    
    var newHash = buildHashParams(hashParams);
    window.location.hash = newHash;
}

// City to precinct mapping
var cityPrecinctMap = {
    'alameda': ['305110', '304800', '305500', '305700', '303800', '302700', '301900', '302200', '300300', '300130', '300150', '300110']
};

// Restore selection from URL on page load
function restoreSelectionFromURL() {
    if (!geojsonLayer) {
        console.log('restoreSelectionFromURL: geojsonLayer not ready');
        return;
    }
    
    // Clear existing selection first to prevent accumulation
    // Reset visual styles of previously selected precincts
    selectedPrecincts.forEach(function(item) {
        if (item.layer) {
            var isCircle = item.layer instanceof L.CircleMarker;
            var yesPct = item.feature && item.feature.properties.percentage ? 
                        item.feature.properties.percentage.yes : null;
            
            if (isCircle) {
                var voteCount = item.feature && item.feature.properties.votes ? 
                              item.feature.properties.votes.total : 0;
                item.layer.setStyle({
                    radius: getCircleRadius(voteCount),
                    fillColor: getColor(yesPct),
                    color: '#fff',
                    weight: 1,
                    fillOpacity: 0.7
                });
            } else {
                // Reset polygon style
                item.layer.setStyle({
                    weight: 1,
                    color: yesPct === null ? '#999999' : 'white',
                    fillOpacity: 0.7,
                    dashArray: yesPct === null ? '5,5' : '3',
                    fillColor: getColor(yesPct)
                });
            }
        }
    });
    
    selectedPrecincts = [];
    isSelectionMode = false;
    
    var precinctIds = [];
    var hashParams = parseHashParams();
    console.log('restoreSelectionFromURL: hashParams =', hashParams);
    
    // Check for city parameter first
    if (hashParams.city && cityPrecinctMap[hashParams.city.toLowerCase()]) {
        // Use city mapping
        precinctIds = cityPrecinctMap[hashParams.city.toLowerCase()];
        currentCityName = hashParams.city.toLowerCase();
        console.log('restoreSelectionFromURL: Found city', hashParams.city, 'with', precinctIds.length, 'precincts');
    } else {
        currentCityName = null;
        
        // Check for precincts in hash
        if (hashParams.precincts) {
            // Handle both + and , for backwards compatibility
            precinctIds = hashParams.precincts.split(/[+,]/);
            console.log('restoreSelectionFromURL: Found precincts in URL:', precinctIds.length);
        } else {
            console.log('restoreSelectionFromURL: No city or precincts found');
            return;
        }
    }
    
    if (precinctIds.length === 0) {
        console.log('restoreSelectionFromURL: No precinct IDs to restore');
        return;
    }
    
    // Wait for layers to be populated
    setTimeout(function() {
        var foundCount = 0;
        var layerSource = mapMode === 'proportional' && circleLayer ? circleLayer : geojsonLayer;
        
        if (!layerSource) {
            return;
        }
        
        layerSource.eachLayer(function(layer) {
            var feature = layer.feature;
            if (!feature) return;
            
            var props = feature.properties;
            var precinctId = props.Precinct_ID || 
                            props['Precinct_ID'] || 
                            props.precinct || 
                            props['precinct'] ||
                            props.ID || 
                            props['ID'] || 
                            null;
            
            // Convert to string for comparison
            var precinctIdStr = precinctId ? precinctId.toString() : null;
            
            if (precinctIdStr && precinctIds.indexOf(precinctIdStr) !== -1) {
                foundCount++;
                selectedPrecincts.push({ feature: feature, layer: layer });
                
                // Set style with black border
                var yesPct = feature.properties.percentage ? feature.properties.percentage.yes : null;
                var isCircle = layer instanceof L.CircleMarker;
                
                if (isCircle) {
                    // For circles, add black border
                    var voteCount = feature.properties.votes ? feature.properties.votes.total : 0;
                    layer.setStyle({
                        radius: getCircleRadius(voteCount),
                        fillColor: getColor(yesPct),
                        color: '#000000',
                        weight: 3,
                        fillOpacity: 0.8
                    });
                } else {
                    // For polygons
                    layer.setStyle({
                        weight: 4,
                        color: '#000000',
                        fillOpacity: 0.8,
                        dashArray: '',
                        fillColor: getColor(yesPct)
                    });
                }
                
                // Bring to front to ensure visibility
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    layer.bringToFront();
                }
                isSelectionMode = true;
            }
        });
        
        console.log('Restored ' + foundCount + ' precincts from URL. Looking for:', precinctIds);
        
        if (selectedPrecincts.length > 0) {
            updateAggregatedTotals();
            
            // Calculate bounds of selected precincts and center/zoom map
            var bounds = L.latLngBounds([]);
            selectedPrecincts.forEach(function(item) {
                if (!item || !item.feature) return;
                try {
                    var tmp = L.geoJSON(item.feature);
                    var b = tmp.getBounds();
                    if (b && b.isValid()) bounds.extend(b);
                } catch (e) {}
            });
            
            if (bounds.isValid()) {
                // If bounds are too small (same point), add padding
                var north = bounds.getNorth();
                var south = bounds.getSouth();
                var east = bounds.getEast();
                var west = bounds.getWest();
                var latDiff = north - south;
                var lngDiff = east - west;
                
                // If bounds are too small, add minimum padding
                if (latDiff === 0 || lngDiff === 0) {
                    latDiff = 0.01; // ~1km
                    lngDiff = 0.01;
                }
                
                // Add padding to bounds (10% on each side)
                var padding = 0.1;
                
                // Shift center north to account for bottom panel (add more padding to south)
                var isMobile = window.innerWidth <= 768;
                var southPaddingMultiplier = isMobile ? 4 : 3; // Even more padding on mobile
                var southPadding = latDiff * padding * southPaddingMultiplier; // More padding on south
                var northPadding = latDiff * padding * 0.3; // Less padding on north
                
                var paddedBounds = L.latLngBounds([
                    [south - southPadding, west - (lngDiff * padding)],
                    [north + northPadding, east + (lngDiff * padding)]
                ]);
                
                // Add more padding to bottom to account for bottom panel
                // Calculate bottom panel height dynamically
                var bottomPanel = document.getElementById('bottom-panel');
                var bottomPadding = bottomPanel ? bottomPanel.offsetHeight + (isMobile ? 160 : 100) : (isMobile ? 380 : 260);
                
                map.fitBounds(paddedBounds, {
                    paddingTopLeft: L.point(20, 20),
                    paddingBottomRight: L.point(20, bottomPadding)
                }); // asymmetric padding to shift view up
                applyMobileVerticalBias();
            }
        }
    }, 1000);
}

// Clear selection on Escape, toggle map mode on 'M'
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isSelectionMode) {
        // Reset all selected precincts
        selectedPrecincts.forEach(function(item) {
            if (mapMode === 'shaded') {
                geojsonLayer.resetStyle(item.layer);
            } else {
                // Reset circle style
                if (item.layer && item.layer.setStyle) {
                    var yesPct = item.layer.feature && item.layer.feature.properties.percentage ? 
                                item.layer.feature.properties.percentage.yes : null;
                    var voteCount = item.layer.feature && item.layer.feature.properties.votes ? 
                                   item.layer.feature.properties.votes.total : 0;
                    item.layer.setStyle({
                        radius: getCircleRadius(voteCount),
                        fillColor: getColor(yesPct),
                        color: '#fff',
                        weight: 1
                    });
                }
            }
        });
        selectedPrecincts = [];
        isSelectionMode = false;
        currentCityName = null;
        updateURL();
        if (selectedPrecincts.length > 0) {
            updateAggregatedTotals();
        } else {
            updateInfoSection(null);
        }
    } else if (e.key === 'm' || e.key === 'M') {
        // Toggle map mode
        toggleMapMode();
    }
});

// Add event listeners
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: togglePrecinctSelection
    });
}

// Add GeoJSON layer
var geojsonLayer = L.geoJSON(null, {
    style: style,
    onEachFeature: onEachFeature
});

// Only add to map if in shaded mode (default is shaded)
if (mapMode === 'shaded') {
    geojsonLayer.addTo(map);
}

// County totals (will be calculated from data)
var countyTotals = {
    yes: 0,
    no: 0,
    total: 0,
    mailInTotal: 0,
    mailInYes: 0,
    mailInNo: 0,
    inPersonTotal: 0,
    inPersonYes: 0,
    inPersonNo: 0
};

// Load GeoJSON data and results.json
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
    .then(function(results) {
        var data = results[0];
        var resultsData = results[1];
        
        console.log('Loaded GeoJSON with', data.features.length, 'features');
        
        if (!resultsData || !Array.isArray(resultsData)) {
            throw new Error('results.json is invalid or empty');
        }
        
        // Create a map of all vote data from results.json
        var resultsMap = {};
        resultsData.forEach(function(result) {
            if (result.precinct) {
                resultsMap[result.precinct] = {
                    votes: result.votes || null,
                    percentage: result.percentage || null,
                    vote_method: result.vote_method || null
                };
            }
        });
        
        // Merge all vote data from results.json into GeoJSON features
        data.features.forEach(function(feature) {
            var precinctId = feature.properties.Precinct_ID || 
                            feature.properties['Precinct_ID'] || 
                            feature.properties.precinct || 
                            feature.properties['precinct'] ||
                            feature.properties.ID || 
                            feature.properties['ID'];
            
            if (precinctId && resultsMap[precinctId.toString()]) {
                var voteData = resultsMap[precinctId.toString()];
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
        
        console.log('Merged vote data from results.json');
        
        // Reset county totals before calculation to prevent accumulation
        countyTotals.yes = 0;
        countyTotals.no = 0;
        countyTotals.total = 0;
        countyTotals.mailInTotal = 0;
        countyTotals.mailInYes = 0;
        countyTotals.mailInNo = 0;
        countyTotals.inPersonTotal = 0;
        countyTotals.inPersonYes = 0;
        countyTotals.inPersonNo = 0;
        
        // Calculate county totals from results.json with error handling
        try {
            resultsData.forEach(function(result) {
                if (!result) return;
                
                // Calculate overall vote totals
                if (result.votes && typeof result.votes === 'object') {
                    var votes = result.votes;
                    if (typeof votes.yes === 'number' && votes.yes > 0) {
                        countyTotals.yes += votes.yes;
                    }
                    if (typeof votes.no === 'number' && votes.no > 0) {
                        countyTotals.no += votes.no;
                    }
                    if (typeof votes.total === 'number' && votes.total > 0) {
                        countyTotals.total += votes.total;
                    }
                }
                
                // Calculate county-level vote method totals
                if (result.vote_method && typeof result.vote_method === 'object') {
                    if (result.vote_method.mail_in && result.vote_method.mail_in.votes && typeof result.vote_method.mail_in.votes === 'object') {
                        var mailInVotes = result.vote_method.mail_in.votes;
                        if (typeof mailInVotes.total === 'number' && mailInVotes.total > 0) {
                            countyTotals.mailInTotal += mailInVotes.total;
                        }
                        if (typeof mailInVotes.yes === 'number' && mailInVotes.yes > 0) {
                            countyTotals.mailInYes += mailInVotes.yes;
                        }
                        if (typeof mailInVotes.no === 'number' && mailInVotes.no > 0) {
                            countyTotals.mailInNo += mailInVotes.no;
                        }
                    }
                    if (result.vote_method.in_person && result.vote_method.in_person.votes && typeof result.vote_method.in_person.votes === 'object') {
                        var inPersonVotes = result.vote_method.in_person.votes;
                        if (typeof inPersonVotes.total === 'number' && inPersonVotes.total > 0) {
                            countyTotals.inPersonTotal += inPersonVotes.total;
                        }
                        if (typeof inPersonVotes.yes === 'number' && inPersonVotes.yes > 0) {
                            countyTotals.inPersonYes += inPersonVotes.yes;
                        }
                        if (typeof inPersonVotes.no === 'number' && inPersonVotes.no > 0) {
                            countyTotals.inPersonNo += inPersonVotes.no;
                        }
                    }
                }
            });
        } catch (error) {
            console.error('Error calculating county totals:', error);
            // Reset to safe defaults on error
            countyTotals.yes = 0;
            countyTotals.no = 0;
            countyTotals.total = 0;
            countyTotals.mailInTotal = 0;
            countyTotals.mailInYes = 0;
            countyTotals.mailInNo = 0;
            countyTotals.inPersonTotal = 0;
            countyTotals.inPersonYes = 0;
            countyTotals.inPersonNo = 0;
        }
        
        // Calculate percentages
        if (countyTotals.total > 0) {
            countyTotals.yesPct = (countyTotals.yes / countyTotals.total) * 100;
            countyTotals.noPct = (countyTotals.no / countyTotals.total) * 100;
        } else {
            countyTotals.yesPct = 0;
            countyTotals.noPct = 0;
        }
        
        // Calculate county-level mail-in percentage of total votes
        if (countyTotals.total > 0) {
            countyTotals.mailInPctOfTotal = (countyTotals.mailInTotal / countyTotals.total) * 100;
        } else {
            countyTotals.mailInPctOfTotal = 0;
        }
        
        // Calculate county-level mail-in YES percentage
        if (countyTotals.mailInTotal > 0) {
            countyTotals.mailInYesPct = (countyTotals.mailInYes / countyTotals.mailInTotal) * 100;
        } else {
            countyTotals.mailInYesPct = 0;
        }
        
        // Calculate county-level in-person YES percentage
        if (countyTotals.inPersonTotal > 0) {
            countyTotals.inPersonYesPct = (countyTotals.inPersonYes / countyTotals.inPersonTotal) * 100;
        } else {
            countyTotals.inPersonYesPct = 0;
        }
        
        // Add data based on current mode
        if (mapMode === 'proportional') {
            createProportionalSymbols(data);
            // Also add to geojsonLayer for selection/restore functionality
            geojsonLayer.addData(data);
            geojsonLayer.removeFrom(map); // Hide polygons, show circles
        } else {
            geojsonLayer.addData(data);
        }
        
        // Fit bounds
        // Establish stable geographic bounds from polygon geometry only (circles can extend beyond)
        if (!baseDistrictBounds && geojsonLayer.getBounds && geojsonLayer.getBounds().isValid()) {
            baseDistrictBounds = geojsonLayer.getBounds();
        }
        if (baseDistrictBounds) {
            var isMobileInit = window.innerWidth <= 768;
            var bottomPanelInit = document.getElementById('bottom-panel');
            var bottomPaddingInit = bottomPanelInit ? bottomPanelInit.offsetHeight + (isMobileInit ? 140 : 80) : (isMobileInit ? 360 : 240);
            var sidePaddingInit = isMobileInit ? 20 : 50;
            var topPaddingInit = isMobileInit ? 20 : 50;
            map.fitBounds(baseDistrictBounds, {
                paddingTopLeft: L.point(sidePaddingInit, topPaddingInit),
                paddingBottomRight: L.point(sidePaddingInit, bottomPaddingInit)
            });
            applyMobileVerticalBias();
        } else if (geojsonLayer.getBounds && geojsonLayer.getBounds().isValid()) {
            var isMobileInitB = window.innerWidth <= 768;
            var bottomPanelInitB = document.getElementById('bottom-panel');
            var bottomPaddingInitB = bottomPanelInitB ? bottomPanelInitB.offsetHeight + (isMobileInitB ? 140 : 80) : (isMobileInitB ? 360 : 240);
            var sidePaddingInitB = isMobileInitB ? 20 : 50;
            var topPaddingInitB = isMobileInitB ? 20 : 50;
            map.fitBounds(geojsonLayer.getBounds(), {
                paddingTopLeft: L.point(sidePaddingInitB, topPaddingInitB),
                paddingBottomRight: L.point(sidePaddingInitB, bottomPaddingInitB)
            });
            applyMobileVerticalBias();
        } else {
            console.error('Invalid bounds');
        }
        
        // Update info section with county totals
        updateInfoSection(null);
        
        // Update button text based on initial mode
        var btn = document.getElementById('toggle-mode-btn');
        if (btn) {
            btn.textContent = mapMode === 'proportional' ? 'Mode – Proportional Districts' : 'Mode – Shaded Districts';
        }
        
        // Restore selection from URL if present (do this first to set currentCityName)
        restoreSelectionFromURL();
        
        // Set initial hash if not present (but preserve city/precincts if they exist)
        var hashParams = parseHashParams();
        if (!hashParams.mode) {
            // Only update if mode is missing, preserve city and precincts
            updateModeURL();
        }
        
        // Listen for hash changes (back/forward navigation)
        window.addEventListener('hashchange', function() {
            var hashParams = parseHashParams();
            var newMode = (hashParams.mode === 'proportional') ? 'proportional' : 'shaded';
            
            // Update mode if changed
            if (newMode !== mapMode) {
                mapMode = newMode;
                toggleMapMode();
            }
            
            // Restore selection
            restoreSelectionFromURL();
        });
    })
    .catch(error => {
        console.error('Error loading data:', error);
        console.error('Error details:', error.message, error.stack);
        alert('Error loading map data: ' + error.message + '\n\nMake sure precincts_consolidated.geojson and results.json are in the same directory as this HTML file and that you are accessing the page through a web server (not file://).');
    });

// Helper function to generate a vote method bar graph
function generateVoteMethodBarGraph(config) {
    var yesPct = config.yesPct || 0;
    var noPct = config.noPct || 0;
    var totalVotes = config.totalVotes || 0;
    var label = config.label || '';
    var countyAvgPct = config.countyAvgPct;
    var yesColor = config.yesColor || COLORS.YES;
    var noColor = config.noColor || COLORS.NO;
    
    if (totalVotes === 0) {
        return '';
    }
    
    var html = `
        <div class="vote-method-bar-wrapper" style="margin-bottom: ${SIZES.MARGIN_BOTTOM_MEDIUM};">
            <div class="vote-method-label-row" style="position: relative; margin-bottom: ${SIZES.MARGIN_BOTTOM_SMALL}; font-size: ${SIZES.FONT_SMALL}; font-weight: 500; color: ${OPACITY.TEXT_PRIMARY}; padding: 0; width: 100%;">
                <span>${yesPct.toFixed(1)}%</span>
                <span style="position: absolute; left: 50%; transform: translateX(-50%); font-size: ${SIZES.FONT_XSMALL}; color: ${OPACITY.TEXT_SECONDARY}; font-weight: normal;">${label} – ${totalVotes.toLocaleString()} votes</span>
                <span>${noPct.toFixed(1)}%</span>
            </div>
            <div class="bar-graph" style="height: ${SIZES.BAR_GRAPH_HEIGHT}; position: relative; display: flex; overflow: hidden; border-radius: ${SIZES.BAR_GRAPH_BORDER_RADIUS}; background: ${OPACITY.BACKGROUND_LIGHT}; margin: 0; width: 100%;">
                <div class="bar-graph-yes" style="width: ${yesPct}%; height: 100%; background: ${yesColor}; flex-shrink: 0;"></div>
                <div class="bar-graph-no" style="width: ${noPct}%; height: 100%; background: ${noColor}; flex-shrink: 0;"></div>
                ${countyAvgPct !== undefined ? `
                <div class="bar-graph-county-marker" style="left: ${countyAvgPct}%;">
                    <div class="bar-graph-county-line"></div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return html;
}

// Helper function to generate method breakdown bar graph
function generateMethodBreakdownBarGraph(config) {
    var mailInPct = config.mailInPct || 0;
    var inPersonPct = config.inPersonPct || 0;
    var totalVotes = config.totalVotes || 0;
    var countyAvgPct = config.countyAvgPct;
    var mailInColor = config.mailInColor || COLORS.METHOD_MAIL_IN;
    var inPersonColor = config.inPersonColor || COLORS.METHOD_IN_PERSON;
    
    if (mailInPct === 0 && inPersonPct === 0) {
        return '';
    }
    
    var html = `
        <div class="vote-method-bar-wrapper" style="margin-bottom: ${SIZES.MARGIN_BOTTOM_MEDIUM};">
            <div class="vote-method-label-row" style="position: relative; margin-bottom: ${SIZES.MARGIN_BOTTOM_SMALL}; font-size: ${SIZES.FONT_SMALL}; font-weight: 500; color: ${OPACITY.TEXT_PRIMARY}; padding: 0; width: 100%;">
                <span>${mailInPct.toFixed(1)}% – MAIL IN</span>
                <span style="position: absolute; left: 50%; transform: translateX(-50%); font-size: ${SIZES.FONT_XSMALL}; color: ${OPACITY.TEXT_SECONDARY}; font-weight: normal;">METHOD</span>
                <span>IN PERSON – ${inPersonPct.toFixed(1)}%</span>
            </div>
            <div class="bar-graph" style="height: ${SIZES.BAR_GRAPH_HEIGHT}; position: relative; display: flex; overflow: hidden; border-radius: ${SIZES.BAR_GRAPH_BORDER_RADIUS}; background: ${OPACITY.BACKGROUND_LIGHT}; margin: 0; width: 100%;">
                <div style="width: ${mailInPct}%; height: 100%; background: ${mailInColor}; flex-shrink: 0;"></div>
                <div style="width: ${inPersonPct}%; height: 100%; background: ${inPersonColor}; flex-shrink: 0;"></div>
                ${countyAvgPct !== undefined ? `
                <div class="bar-graph-county-marker" style="left: ${countyAvgPct}%;">
                    <div class="bar-graph-county-line"></div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return html;
}

// Helper function to safely get a value or return default
function safeGet(obj, path, defaultValue) {
    if (!obj || typeof obj !== 'object') return defaultValue;
    var keys = path.split('.');
    var current = obj;
    for (var i = 0; i < keys.length; i++) {
        if (current === null || current === undefined || typeof current !== 'object') {
            return defaultValue;
        }
        current = current[keys[i]];
        if (current === null || current === undefined) {
            return defaultValue;
        }
    }
    return current;
}

// Helper function to generate county totals HTML
function generateCountyTotalsHTML() {
    return `
        <div class="precinct-name">Alameda County</div>
        <div class="data-columns">
            <div class="data-column">
                <div class="data-column-header">YES</div>
                <div class="data-column-votes">${countyTotals.yes.toLocaleString()} votes</div>
                <div class="data-column-percent">${countyTotals.yesPct.toFixed(1)}%</div>
            </div>
            <div class="data-column">
                <div class="data-column-header">Total</div>
                <div class="data-column-votes">${countyTotals.total.toLocaleString()} votes</div>
                <div class="data-column-percent">—</div>
            </div>
            <div class="data-column">
                <div class="data-column-header">NO</div>
                <div class="data-column-votes">${countyTotals.no.toLocaleString()} votes</div>
                <div class="data-column-percent">${countyTotals.noPct.toFixed(1)}%</div>
            </div>
        </div>
        <div class="bar-graph">
            <div class="bar-graph-yes" style="width: ${countyTotals.yesPct}%;"></div>
            <div class="bar-graph-no" style="width: ${countyTotals.noPct}%;"></div>
        </div>
    `;
}

// Helper function to get title from props
function getTitleFromProps(props) {
    if (props.aggregated) {
        if (props.cityName) {
            return 'City of ' + props.cityName.charAt(0).toUpperCase() + props.cityName.slice(1);
        }
        return (props.count || 0) + ' Precincts Selected';
    }
    
    var precinctName = safeGet(props, 'Precinct_ID', null) ||
                      safeGet(props, 'precinct', null) ||
                      safeGet(props, 'ID', null) ||
                      'N/A';
    return 'Precinct ' + precinctName;
}

// Helper function to extract vote data from props
function extractVoteData(props) {
    var hasVotes = !!(props && props.votes && typeof props.votes.total === 'number' && props.votes.total > 0);
    
    if (!hasVotes) {
        return {
            hasVotes: false,
            yesPct: 0,
            yesVotes: 0,
            noPct: 0,
            noVotes: 0,
            totalVotes: 0
        };
    }
    
    return {
        hasVotes: true,
        yesPct: safeGet(props, 'percentage.yes', 0),
        yesVotes: safeGet(props, 'votes.yes', 0),
        noPct: safeGet(props, 'percentage.no', 0),
        noVotes: safeGet(props, 'votes.no', 0),
        totalVotes: safeGet(props, 'votes.total', 0)
    };
}

// Helper function to generate main bar graph HTML
function generateMainBarGraphHTML(voteData) {
    if (!voteData.hasVotes || voteData.totalVotes === 0) {
        return '';
    }
    
    var countyMarker = (countyTotals.yesPct !== undefined) ? `
        <div class="bar-graph-county-marker" style="left: ${countyTotals.yesPct}%;">
            <div class="bar-graph-county-line"></div>
        </div>
    ` : '';
    
    var countyLabel = (countyTotals.yesPct !== undefined) ? `
        <div class="bar-graph-county-label" style="position: absolute; left: ${countyTotals.yesPct}%; transform: translateX(-50%); bottom: -18px; padding-bottom: 2px;">County Avg.</div>
    ` : '';
    
    return `
        <div style="position: relative;">
            <div class="bar-graph">
                <div class="bar-graph-yes" style="width: ${voteData.yesPct}%;"></div>
                <div class="bar-graph-no" style="width: ${voteData.noPct}%;"></div>
                ${countyMarker}
            </div>
            ${countyLabel}
        </div>
    `;
}

// Helper function to generate data columns HTML
function generateDataColumnsHTML(voteData) {
    var yesDisplay = voteData.hasVotes ? voteData.yesVotes.toLocaleString() + ' votes' : '&nbsp;';
    var yesPctDisplay = voteData.hasVotes ? voteData.yesPct.toFixed(1) + '%' : '&nbsp;';
    var totalDisplay = voteData.hasVotes ? voteData.totalVotes.toLocaleString() + ' votes' : '&nbsp;';
    var noDisplay = voteData.hasVotes ? voteData.noVotes.toLocaleString() + ' votes' : '&nbsp;';
    var noPctDisplay = voteData.hasVotes ? voteData.noPct.toFixed(1) + '%' : '&nbsp;';
    
    return `
        <div class="data-columns">
            <div class="data-column">
                <div class="data-column-header">YES</div>
                <div class="data-column-votes">${yesDisplay}</div>
                <div class="data-column-percent">${yesPctDisplay}</div>
            </div>
            <div class="data-column">
                <div class="data-column-header">Total</div>
                <div class="data-column-votes">${totalDisplay}</div>
                <div class="data-column-percent">—</div>
            </div>
            <div class="data-column">
                <div class="data-column-header">NO</div>
                <div class="data-column-votes">${noDisplay}</div>
                <div class="data-column-percent">${noPctDisplay}</div>
            </div>
        </div>
    `;
}

// Helper function to generate vote method breakdown HTML
function generateVoteMethodBreakdownHTML(props, voteData) {
    if (!voteData.hasVotes || !props.vote_method || typeof props.vote_method !== 'object') {
        return '';
    }
    
    var mailIn = safeGet(props, 'vote_method.mail_in', {});
    var inPerson = safeGet(props, 'vote_method.in_person', {});
    var mailInVotes = safeGet(mailIn, 'votes', {});
    var inPersonVotes = safeGet(inPerson, 'votes', {});
    var mailInPct = safeGet(mailIn, 'percentage', {});
    var inPersonPct = safeGet(inPerson, 'percentage', {});
    
    var mailInYesPct = safeGet(mailInPct, 'yes', 0);
    var mailInNoPct = safeGet(mailInPct, 'no', 0);
    var inPersonYesPct = safeGet(inPersonPct, 'yes', 0);
    var inPersonNoPct = safeGet(inPersonPct, 'no', 0);
    var mailInPctOfTotal = safeGet(mailIn, 'percentage_of_total', 0);
    var inPersonPctOfTotal = safeGet(inPerson, 'percentage_of_total', 0);
    var methodBreakdownTotal = (safeGet(mailInVotes, 'total', 0) || 0) + (safeGet(inPersonVotes, 'total', 0) || 0);
    
    return `
        <div class="vote-method-breakdown" style="margin-top: ${SIZES.MARGIN_TOP_SECTION}; padding-top: ${SIZES.MARGIN_TOP_SECTION}; border-top: 1px solid ${OPACITY.BORDER_LIGHT};">
            <div class="vote-method-header" onclick="toggleVoteMethodSection(this)">
                <span>Vote Method</span>
                <span class="vote-method-arrow">›</span>
            </div>
            <div class="vote-method-content">
                ${generateVoteMethodBarGraph({
                    yesPct: mailInYesPct,
                    noPct: mailInNoPct,
                    totalVotes: safeGet(mailInVotes, 'total', 0) || 0,
                    label: 'MAIL IN',
                    countyAvgPct: countyTotals.mailInYesPct
                })}
                ${generateVoteMethodBarGraph({
                    yesPct: inPersonYesPct,
                    noPct: inPersonNoPct,
                    totalVotes: safeGet(inPersonVotes, 'total', 0) || 0,
                    label: 'IN PERSON',
                    countyAvgPct: countyTotals.inPersonYesPct
                })}
                ${generateMethodBreakdownBarGraph({
                    mailInPct: mailInPctOfTotal,
                    inPersonPct: inPersonPctOfTotal,
                    totalVotes: methodBreakdownTotal,
                    countyAvgPct: countyTotals.mailInPctOfTotal
                })}
            </div>
        </div>
    `;
}

// Toggle vote method section
function toggleVoteMethodSection(header) {
    var content = header.nextElementSibling;
    var arrow = header.querySelector('.vote-method-arrow');
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        arrow.classList.remove('expanded');
        voteMethodSectionExpanded = false;
    } else {
        content.classList.add('expanded');
        arrow.classList.add('expanded');
        voteMethodSectionExpanded = true;
    }
}

// Make toggleVoteMethodSection globally accessible
window.toggleVoteMethodSection = toggleVoteMethodSection;

// Update info section in bottom panel
function updateInfoSection(props) {
    var infoSection = document.getElementById('info-section');
    var bottomPanelContent = infoSection.parentElement;
    
    // Get current height
    var currentHeight = bottomPanelContent.offsetHeight;
    bottomPanelContent.style.height = currentHeight + 'px';
    
    // Fade out
    infoSection.style.opacity = '0';
    
    setTimeout(function() {
        var content;
        
        if (!props) {
            // Show county totals
            content = generateCountyTotalsHTML();
        } else {
            // Generate content for precinct or aggregated data
            var title = getTitleFromProps(props);
            var voteData = extractVoteData(props);
            
            content = `
                <div class="precinct-name">${title}</div>
                ${generateDataColumnsHTML(voteData)}
                ${generateMainBarGraphHTML(voteData)}
                ${generateVoteMethodBreakdownHTML(props, voteData)}
            `;
        }
        
        infoSection.innerHTML = content;
        
        // Restore vote method section expanded state if it was previously expanded
        if (voteMethodSectionExpanded) {
            var voteMethodHeader = infoSection.querySelector('.vote-method-header');
            if (voteMethodHeader) {
                var voteMethodContent = voteMethodHeader.nextElementSibling;
                var voteMethodArrow = voteMethodHeader.querySelector('.vote-method-arrow');
                if (voteMethodContent && voteMethodArrow) {
                    voteMethodContent.classList.add('expanded');
                    voteMethodArrow.classList.add('expanded');
                }
            }
        }
        
        // Get new height and transition
        setTimeout(function() {
            var newHeight = bottomPanelContent.scrollHeight;
            bottomPanelContent.style.height = newHeight + 'px';
            
            // Fade in
            infoSection.style.opacity = '1';
            
            // Remove height constraint after transition
            setTimeout(function() {
                bottomPanelContent.style.height = 'auto';
            }, 400);
        }, 10);
    }, 150);
}

// Create horizontal legend
function createHorizontalLegend() {
    var legendContainer = document.getElementById('legend-horizontal');
    
    // Single red key for 0-50% (with detailed shading but simplified legend)
    var itemRed = document.createElement('div');
    itemRed.className = 'legend-item';
    itemRed.innerHTML = '<div class="legend-color" style="background:' + getColor(25) + '"></div><span>0&ndash;50%</span>';
    legendContainer.appendChild(itemRed);
    
    // Green shades for 50-100%
    // 50-75%
    var item50 = document.createElement('div');
    item50.className = 'legend-item';
    item50.innerHTML = '<div class="legend-color" style="background:' + getColor(62.5) + '"></div><span>50&ndash;75%</span>';
    legendContainer.appendChild(item50);
    
    // 75-80%
    var item75 = document.createElement('div');
    item75.className = 'legend-item';
    item75.innerHTML = '<div class="legend-color" style="background:' + getColor(77.5) + '"></div><span>75&ndash;80%</span>';
    legendContainer.appendChild(item75);
    
    // 80-85%
    var item80 = document.createElement('div');
    item80.className = 'legend-item';
    item80.innerHTML = '<div class="legend-color" style="background:' + getColor(82.5) + '"></div><span>80&ndash;85%</span>';
    legendContainer.appendChild(item80);
    
    // 85-90%
    var item85 = document.createElement('div');
    item85.className = 'legend-item';
    item85.innerHTML = '<div class="legend-color" style="background:' + getColor(87.5) + '"></div><span>85&ndash;90%</span>';
    legendContainer.appendChild(item85);
    
    // 90-95%
    var item90 = document.createElement('div');
    item90.className = 'legend-item';
    item90.innerHTML = '<div class="legend-color" style="background:' + getColor(92.5) + '"></div><span>90&ndash;95%</span>';
    legendContainer.appendChild(item90);
    
    // 95-100%
    var item95 = document.createElement('div');
    item95.className = 'legend-item';
    item95.innerHTML = '<div class="legend-color" style="background:' + getColor(97.5) + '"></div><span>95&ndash;100%</span>';
    legendContainer.appendChild(item95);
    
    // No data
    var noDataItem = document.createElement('div');
    noDataItem.className = 'legend-item';
    noDataItem.innerHTML = '<div class="legend-color" style="background:#d3d3d3"></div><span>No data</span>';
    legendContainer.appendChild(noDataItem);
}

createHorizontalLegend();

// Utility: On mobile, bias the map's visual center to 33% from the top
function applyMobileVerticalBias() {
    var isMobile = window.innerWidth <= 768;
    if (!isMobile || !map) return;
    var size = map.getSize();
    var desiredFractionFromTop = 0.33; // 33% down from top
    var deltaY = (0.5 - desiredFractionFromTop) * size.y; // positive means move up
    // Pan map view so the visual center shifts upward
    map.panBy([0, -deltaY], { animate: false });
}

