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
        return '#d3d3d3'; // Light grey for no data or 0%
    }
    // 1-50% as single red shade
    if (yesPct <= 50) {
        return '#fc9272'; // Light red shade for 1-50%
    }
    // Split 50-100% into 6 green steps
    return yesPct >= 100 ? '#006d2c' :  // Darkest green for 100%
           yesPct >= 95 ? '#238b45' :  // Very dark green for 95-100%
           yesPct >= 90 ? '#41ab5d' :  // Dark green for 90-95%
           yesPct >= 85 ? '#74c476' :  // Medium green for 85-90%
           yesPct >= 80 ? '#a1d99b' :  // Light green for 80-85%
           yesPct >= 75 ? '#c7e9c0' :  // Very light green for 75-80%
           '#d4e8d0';                   // Light green for 50-75%
}

// Style function
function style(feature) {
    var props = feature.properties;
    var yesPct = props.percentage && props.percentage.yes !== undefined ? 
                 props.percentage.yes : null;
    return {
        fillColor: getColor(yesPct),
        weight: 1,
        opacity: 1,
        color: yesPct === null ? '#999999' : 'white',
        dashArray: yesPct === null ? '5,5' : '3',
        fillOpacity: 0.7
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
            color: '#666',
            dashArray: '',
            fillOpacity: 0.9
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
            var voteCount = layer.feature.properties.votes ? layer.feature.properties.votes.total : 0;
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
    map.fitBounds(e.target.getBounds());
}

// Selected precincts for aggregation
var selectedPrecincts = [];
var isSelectionMode = false;
var currentCityName = null;

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
    
    // Update button text (show what you'll switch TO next time)
    var btn = document.getElementById('toggle-mode-btn');
    if (btn) {
        // If currently in proportional, button says "Switch to Shaded"
        // If currently in shaded, button says "Switch to Proportional Symbols"
        btn.textContent = mapMode === 'proportional' ? 'Switch to Shaded' : 'Switch to Proportional Symbols';
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
    
    selectedPrecincts.forEach(function(item) {
        var props = item.feature.properties;
        if (props.votes) {
            if (props.votes.yes) aggregated.yes += props.votes.yes;
            if (props.votes.no) aggregated.no += props.votes.no;
            if (props.votes.total) aggregated.total += props.votes.total;
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
                if (item.layer) {
                    try {
                        var isCircle = item.layer instanceof L.CircleMarker;
                        if (isCircle && item.layer.getLatLng) {
                            // For circles, use the center point
                            var latlng = item.layer.getLatLng();
                            bounds.extend(latlng);
                        } else if (item.layer.getBounds) {
                            // For polygons, use bounds
                            var layerBounds = item.layer.getBounds();
                            if (layerBounds.isValid()) {
                                bounds.extend(layerBounds);
                            }
                        }
                    } catch (e) {
                        // Skip if bounds can't be calculated
                    }
                }
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
                var bottomPadding = bottomPanel ? bottomPanel.offsetHeight + (isMobile ? 30 : 20) : (isMobile ? 350 : 250);
                
                map.fitBounds(paddedBounds, { padding: [50, 50, bottomPadding, 50] }); // top, right, bottom, left
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
    total: 0
};

// Load GeoJSON data
fetch('precincts_consolidated.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
        }
        return response.json();
    })
    .then(data => {
        console.log('Loaded GeoJSON with', data.features.length, 'features');
        
        // Calculate county totals
        data.features.forEach(function(feature) {
            if (feature.properties && feature.properties.votes) {
                var votes = feature.properties.votes;
                if (votes.yes) countyTotals.yes += votes.yes;
                if (votes.no) countyTotals.no += votes.no;
                if (votes.total) countyTotals.total += votes.total;
            }
        });
        
        // Calculate percentages
        if (countyTotals.total > 0) {
            countyTotals.yesPct = (countyTotals.yes / countyTotals.total) * 100;
            countyTotals.noPct = (countyTotals.no / countyTotals.total) * 100;
        } else {
            countyTotals.yesPct = 0;
            countyTotals.noPct = 0;
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
        if (mapMode === 'proportional' && circleLayer) {
            if (circleLayer.getBounds().isValid()) {
                map.fitBounds(circleLayer.getBounds());
            }
        } else if (geojsonLayer.getBounds().isValid()) {
            map.fitBounds(geojsonLayer.getBounds());
        } else {
            console.error('Invalid bounds');
        }
        
        // Update info section with county totals
        updateInfoSection(null);
        
        // Update button text based on initial mode
        var btn = document.getElementById('toggle-mode-btn');
        if (btn) {
            btn.textContent = mapMode === 'proportional' ? 'Switch to Shaded' : 'Switch to Proportional Symbols';
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
        console.error('Error loading GeoJSON:', error);
        console.error('Error details:', error.message, error.stack);
        alert('Error loading map data: ' + error.message + '\n\nMake sure precincts_consolidated.geojson is in the same directory as this HTML file and that you are accessing the page through a web server (not file://).');
    });

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
        if (!props) {
            // Show county totals
            var content = '<div class="precinct-name">Alameda County</div>';
            content += '<div class="data-columns">';
            
            // YES column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">YES</div>';
            content += '<div class="data-column-votes">' + countyTotals.yes.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">' + countyTotals.yesPct.toFixed(1) + '%</div>';
            content += '</div>';
            // Total column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">Total</div>';
            content += '<div class="data-column-votes">' + countyTotals.total.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">—</div>';
            content += '</div>';
            // NO column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">NO</div>';
            content += '<div class="data-column-votes">' + countyTotals.no.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">' + countyTotals.noPct.toFixed(1) + '%</div>';
            content += '</div>';
            content += '</div>';
            
            // Add bar graph
            content += '<div class="bar-graph">';
            content += '<div class="bar-graph-yes" style="width: ' + countyTotals.yesPct + '%;"></div>';
            content += '<div class="bar-graph-no" style="width: ' + countyTotals.noPct + '%;"></div>';
            content += '</div>';
            
            infoSection.innerHTML = content;
            
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
            return;
        }
    
        // Check if this is aggregated data
        if (props.aggregated) {
            var title = props.cityName ? 'City of ' + props.cityName.charAt(0).toUpperCase() + props.cityName.slice(1) : props.count + ' Precincts Selected';
            var content = '<div class="precinct-name">' + title + '</div>';
            var hasVotes = props.votes && props.votes.total !== undefined;
        } else {
            // Try multiple ways to get the precinct name
            var precinctName = props.Precinct_ID || 
                              props['Precinct_ID'] || 
                              props.precinct || 
                              props['precinct'] ||
                              props.ID || 
                              props['ID'] || 
                              'N/A';
            
            var hasVotes = props.votes && props.votes.total !== undefined;
            
            var content = '<div class="precinct-name">Precinct ' + precinctName + '</div>';
        }
        
        content += '<div class="data-columns">';
        
        if (hasVotes && props.votes.total > 0) {
            var yesPct = props.percentage ? props.percentage.yes : 0;
            var yesVotes = props.votes.yes || 0;
            var noPct = props.percentage ? props.percentage.no : 0;
            var noVotes = props.votes.no || 0;
            var totalVotes = props.votes.total || 0;
            
            // YES column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">YES</div>';
            content += '<div class="data-column-votes">' + yesVotes.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">' + yesPct.toFixed(1) + '%</div>';
            content += '</div>';
            // Total column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">Total</div>';
            content += '<div class="data-column-votes">' + totalVotes.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">—</div>';
            content += '</div>';
            // NO column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">NO</div>';
            content += '<div class="data-column-votes">' + noVotes.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">' + noPct.toFixed(1) + '%</div>';
            content += '</div>';
        } else {
            // YES column - empty
            content += '<div class="data-column">';
            content += '<div class="data-column-header">YES</div>';
            content += '<div class="data-column-votes">&nbsp;</div>';
            content += '<div class="data-column-percent">&nbsp;</div>';
            content += '</div>';
            // Total column - empty
            content += '<div class="data-column">';
            content += '<div class="data-column-header">Total</div>';
            content += '<div class="data-column-votes">&nbsp;</div>';
            content += '<div class="data-column-percent">—</div>';
            content += '</div>';
            // NO column - empty
            content += '<div class="data-column">';
            content += '<div class="data-column-header">NO</div>';
            content += '<div class="data-column-votes">&nbsp;</div>';
            content += '<div class="data-column-percent">&nbsp;</div>';
            content += '</div>';
        }
        
        content += '</div>';
        
        // Add bar graph - always show structure to maintain bounding box
        var yesPct = (hasVotes && props.votes.total > 0 && props.percentage) ? props.percentage.yes : 0;
        var noPct = (hasVotes && props.votes.total > 0 && props.percentage) ? props.percentage.no : 0;
        content += '<div class="bar-graph">';
        content += '<div class="bar-graph-yes" style="width: ' + yesPct + '%;"></div>';
        content += '<div class="bar-graph-no" style="width: ' + noPct + '%;"></div>';
        // Add county average line for all data (precinct and aggregated)
        if (hasVotes && props.votes.total > 0 && countyTotals.yesPct !== undefined) {
            content += '<div class="bar-graph-county-marker" style="left: ' + countyTotals.yesPct + '%;">';
            content += '<div class="bar-graph-county-line"></div>';
            content += '<div class="bar-graph-county-label">County</div>';
            content += '</div>';
        }
        content += '</div>';
        
        infoSection.innerHTML = content;
        
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

