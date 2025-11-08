// ============================================================================
// MAP MODE
// ============================================================================

// Map visualization mode: 'shaded' or 'proportional'
// Read from URL hash if present, default to 'shaded'
var hashParams = parseHashParams();
var mapMode = (hashParams.mode === 'proportional') ? 'proportional' : 'shaded';
var circleLayer = null;
var maxVotes = 0; // Will be calculated from data
// Note: getCircleRadius() is defined in map-styling.js

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
        var voteCount = getVoteCount(props);
        var yesPct = getYesPercentage(props);
        
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

