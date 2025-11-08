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
    attribution: '<a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> & <a href="https://carto.com/attributions">CARTO</a>',
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
    var yesPct = getYesPercentage(props);
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

// Selected precincts for aggregation
var selectedPrecincts = [];
var currentCityName = null;
var voteMethodSectionExpanded = false;
var cityDropdownCloseHandler = null; // Store close handler reference for cleanup
var cityStats = {}; // Cache for city statistics
var cityDropdownOpen = false;
// Stable geographic bounds derived from precinct polygons (never circles)
var baseDistrictBounds = null;
// Guards to avoid duplicate listeners and repeated restores
var hashListenerBound = false;
var restoreInProgress = false;
var lastRestoreSignature = '';

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

// Helper function to extract precinct ID from properties
function getPrecinctId(props) {
    return props.Precinct_ID || 
           props['Precinct_ID'] || 
           props.precinct || 
           props['precinct'] ||
           props.ID || 
           props['ID'] || 
           null;
}

// Helper function to get yes percentage from properties
function getYesPercentage(props) {
    return (props.percentage && props.percentage.yes !== undefined) ? props.percentage.yes : null;
}

// Helper function to get vote count from properties
function getVoteCount(props) {
    return (props.votes && props.votes.total) ? props.votes.total : 0;
}

// Helper function to set circle style
function setCircleStyle(circle, yesPct, voteCount, isSelected) {
    var style = {
        radius: getCircleRadius(voteCount),
        fillColor: getColor(yesPct),
        fillOpacity: isSelected ? OPACITY.FILL_SELECTED : OPACITY.FILL_DEFAULT,
        weight: isSelected ? 3 : 1,
        color: isSelected ? COLORS.BORDER_SELECTED : COLORS.BORDER_DEFAULT,
        opacity: 0.8
    };
    circle.setStyle(style);
}

// Helper function to set polygon style
function setPolygonStyle(layer, yesPct, isSelected) {
    var style = {
        fillColor: getColor(yesPct),
        fillOpacity: isSelected ? OPACITY.FILL_SELECTED : OPACITY.FILL_DEFAULT,
        weight: isSelected ? 4 : 1,
        color: isSelected ? COLORS.BORDER_SELECTED : (yesPct === null ? COLORS.BORDER_NO_DATA : COLORS.BORDER_DEFAULT),
        dashArray: isSelected ? '' : (yesPct === null ? '5,5' : '3'),
        opacity: 1
    };
    layer.setStyle(style);
}

// Helper function to reset layer style (for polygons)
function resetLayerStyle(layer, yesPct) {
    if (layer instanceof L.CircleMarker) {
        var voteCount = getVoteCount(layer.feature.properties);
        setCircleStyle(layer, yesPct, voteCount, false);
    } else {
        setPolygonStyle(layer, yesPct, false);
    }
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
    
    // Only update mode if it's not the default 'shaded'
    // This way we don't add mode/shaded/ to URLs unless user switches to proportional
    if (mapMode !== 'shaded') {
        hashParams.mode = mapMode;
    } else {
        // Remove mode from params if it's the default
        delete hashParams.mode;
    }
    
    // Preserve city from URL if it exists, or use currentCityName (normalize for URL)
    if (hashParams.city) {
        // Keep city from URL
    } else if (currentCityName) {
        hashParams.city = normalizeCityName(currentCityName);
    }
    
    // Preserve precincts from URL if they exist, or use selectedPrecincts
    if (hashParams.precincts) {
        // Keep precincts from URL
    } else if (selectedPrecincts.length > 0) {
        var precinctIds = selectedPrecincts.map(function(item) {
            var id = getPrecinctId(item.feature.properties);
            return id ? id.toString() : 'N/A';
        }).join('+');
        if (precinctIds) {
            hashParams.precincts = precinctIds;
        }
    }
    
    var newHash = buildHashParams(hashParams);
    window.location.hash = newHash;
}

// Update URL with selected precinct numbers
function updateURL() {
    var hashParams = parseHashParams();
    
    // Only include mode if it's not the default 'shaded'
    if (mapMode !== 'shaded') {
        hashParams.mode = mapMode;
    } else {
        delete hashParams.mode;
    }
    
    // Get precinct IDs
    var precinctIds = selectedPrecincts.map(function(item) {
        var id = getPrecinctId(item.feature.properties);
        return id ? id.toString() : 'N/A';
    }).join('+');
    
    if (precinctIds && selectedPrecincts.length > 0) {
        hashParams.precincts = precinctIds;
        // Clear city when manually selecting precincts
        delete hashParams.city;
    } else {
        delete hashParams.precincts;
        // Only include city if we have a city selection and no individual precincts
        if (currentCityName) {
            hashParams.city = normalizeCityName(currentCityName);
        } else {
            delete hashParams.city;
        }
    }
    
    var newHash = buildHashParams(hashParams);
    window.location.hash = newHash;
}

// Helper function to normalize city name for URL (lowercase, spaces/underscores to hyphens - kebab-case)
// Rewrites snake_case to kebab-case
function normalizeCityName(cityName) {
    if (!cityName) return null;
    // Convert to lowercase, then replace spaces and underscores with hyphens (kebab-case)
    return cityName.toLowerCase().replace(/[\s_]+/g, '-');
}

// Helper function to denormalize city name from URL (supports both hyphens and underscores, capitalize first letter)
function denormalizeCityName(normalizedCityName) {
    if (!normalizedCityName) return null;
    // Replace both hyphens and underscores with spaces for backwards compatibility
    return normalizedCityName.replace(/[-_]/g, ' ').split(' ').map(function(word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}

// Helper function to get display city name (treats "Alameda County" as "Unincorporated Alameda County")
function getDisplayCityName(city) {
    if (!city) return null;
    // Treat "Alameda County" as "Unincorporated Alameda County" for city stats
    // (The county-wide "Alameda County" option at top shows all precincts combined)
    if (city.toLowerCase() === 'alameda county') {
        return 'Unincorporated Alameda County';
    }
    return city;
}

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
            var precinctId = getPrecinctId(feature.properties);
            
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
        
        // Calculate city statistics
        cityStats = calculateCityStats(data);
        
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
        
        // Build city dropdown (after county totals are calculated)
        // Only build once to avoid duplicates
        if (Object.keys(cityStats).length > 0) {
            buildCityDropdown();
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
        
        // Check if city/precincts are in URL - if so, fit to those instead of all districts
        var hashParams = parseHashParams();
        var precinctIds = [];
        var boundsToFit = null;
        
        if (hashParams.city) {
            // Find precincts by matching city property
            // Normalize city name (converts snake_case to kebab-case)
            var normalizedCityName = normalizeCityName(hashParams.city);
            
            // Rewrite URL to kebab-case if it was snake_case
            if (hashParams.city !== normalizedCityName) {
                hashParams.city = normalizedCityName;
                var newHash = buildHashParams(hashParams);
                window.location.hash = newHash;
            }
            
            // Calculate bounds of precincts matching the city
            var selectedBounds = L.latLngBounds([]);
            geojsonLayer.eachLayer(function(layer) {
                var feature = layer.feature;
                if (!feature) return;
                var props = feature.properties;
                var featureCity = safeGet(props, 'city', null);
                
                // Get display city name (treats "Alameda County" as "Unincorporated Alameda County")
                var displayCity = getDisplayCityName(featureCity);
                
                var normalizedFeatureCity = normalizeCityName(displayCity);
                
                if (normalizedFeatureCity === normalizedCityName) {
                    try {
                        var tmp = L.geoJSON(feature);
                        var b = tmp.getBounds();
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
            var selectedBounds = L.latLngBounds([]);
            geojsonLayer.eachLayer(function(layer) {
                var feature = layer.feature;
                if (!feature) return;
                var props = feature.properties;
                var precinctId = getPrecinctId(props);
                var precinctIdStr = precinctId ? precinctId.toString() : null;
                if (precinctIdStr && precinctIds.indexOf(precinctIdStr) !== -1) {
                    try {
                        var tmp = L.geoJSON(feature);
                        var b = tmp.getBounds();
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
            boundsToFit = baseDistrictBounds || (geojsonLayer.getBounds && geojsonLayer.getBounds().isValid() ? geojsonLayer.getBounds() : null);
        }
        
        if (boundsToFit) {
            var isMobileInit = window.innerWidth <= 768;
            var bottomPanelInit = document.getElementById('bottom-panel');
            var bottomPaddingInit = bottomPanelInit ? bottomPanelInit.offsetHeight + (isMobileInit ? 140 : 80) : (isMobileInit ? 360 : 240);
            var sidePaddingInit = isMobileInit ? 50 : 80; // Mobile: zoomed out one more level, Desktop: unchanged
            var topPaddingInit = isMobileInit ? 50 : 80; // Mobile: zoomed out one more level, Desktop: unchanged
            map.fitBounds(boundsToFit, {
                paddingTopLeft: L.point(sidePaddingInit, topPaddingInit),
                paddingBottomRight: L.point(sidePaddingInit, bottomPaddingInit)
            });
            setTimeout(function() {
                applyMobileVerticalBias();
                applyDesktopDefaultBiasIfNeeded();
            }, 100);
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
        
        // Update city button text after initial load
        updateCityButtonText();
        
        // Don't set initial hash - only update URL when user actually changes mode
        // This preserves URLs like #city/alameda without adding mode/shaded/
        
        // Listen for hash changes (back/forward navigation)
        if (!hashListenerBound) {
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
            hashListenerBound = true;
        }
    })
    .catch(error => {
        console.error('Error loading data:', error);
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
    
    // Get neighborhood and city
    var neighborhood = safeGet(props, 'neighborhood', null);
    var city = safeGet(props, 'city', null);
    
    // Build title with neighborhood and city if available
    var titleParts = [];
    if (neighborhood) {
        titleParts.push(neighborhood);
    }
    if (city) {
        titleParts.push(city);
    }
    
    if (titleParts.length > 0) {
        return titleParts.join(', ') + ' – Precinct ' + precinctName;
    }
    
    // Fallback to just precinct number if no location data
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
    
    // Legend items: [label, color]
    var legendItems = [
        ['0&ndash;50%', COLORS.RED_SHADE],           // Red shade
        ['50%+', COLORS.GREEN_50],                   // 50-75%
        ['75%+', COLORS.GREEN_75],                   // 75-80%
        ['80%+', COLORS.GREEN_80],                   // 80-85%
        ['85%+', COLORS.GREEN_85],                   // 85-90%
        ['90%+', COLORS.GREEN_90],                   // 90-95%
        ['95%+', COLORS.GREEN_95],                   // 95-100%
        ['No data', COLORS.NO_DATA]                  // No data (gray)
    ];
    
    legendItems.forEach(function(item) {
        var div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = '<div class="legend-color" style="background:' + item[1] + '"></div><span>' + item[0] + '</span>';
        legendContainer.appendChild(div);
    });
}

createHorizontalLegend();

// Calculate city statistics from GeoJSON data
function calculateCityStats(data) {
    var stats = {};
    
    if (!data || !data.features) {
        return stats;
    }
    
    data.features.forEach(function(feature) {
        var props = feature.properties;
        var city = safeGet(props, 'city', null);
        
        if (!city) return;
        
        // Get display city name (treats "Alameda County" as "Unincorporated Alameda County")
        var displayCity = getDisplayCityName(city);
        
        // Normalize city name for grouping
        var normalizedCity = normalizeCityName(displayCity);
        if (!stats[normalizedCity]) {
            stats[normalizedCity] = {
                name: displayCity,
                yes: 0,
                no: 0,
                total: 0
            };
        }
        
        // Aggregate votes
        if (props.votes) {
            if (props.votes.yes) stats[normalizedCity].yes += props.votes.yes;
            if (props.votes.no) stats[normalizedCity].no += props.votes.no;
            if (props.votes.total) stats[normalizedCity].total += props.votes.total;
        }
    });
    
    // Calculate percentages
    Object.keys(stats).forEach(function(key) {
        var city = stats[key];
        if (city.total > 0) {
            city.yesPct = (city.yes / city.total) * 100;
        } else {
            city.yesPct = 0;
        }
    });
    
    return stats;
}

// Build city dropdown
function buildCityDropdown() {
    var dropdownContent = document.getElementById('city-dropdown-content');
    if (!dropdownContent) return;
    
    // Sort cities by name, but exclude "Alameda County" since we add it manually
    var cities = Object.keys(cityStats).map(function(key) {
        return {
            key: key,
            name: cityStats[key].name,
            yesPct: cityStats[key].yesPct || 0
        };
    }).filter(function(city) {
        // Filter out "Alameda County" - we add it manually at the top
        // Keep "Unincorporated Alameda County" as a distinct option
        var cityNameLower = city.name.toLowerCase();
        return cityNameLower !== 'alameda county';
    }).sort(function(a, b) {
        // Sort alphabetically, but put "Unincorporated Alameda County" at the end
        var aIsUnincorporated = a.name.toLowerCase() === 'unincorporated alameda county';
        var bIsUnincorporated = b.name.toLowerCase() === 'unincorporated alameda county';
        
        if (aIsUnincorporated && !bIsUnincorporated) return 1;
        if (!aIsUnincorporated && bIsUnincorporated) return -1;
        return a.name.localeCompare(b.name);
    });
    
    // Clear existing content
    dropdownContent.innerHTML = '';
    
    // Add "Alameda County" option at the top
    var countyItem = document.createElement('div');
    countyItem.className = 'city-dropdown-item';
    countyItem.setAttribute('data-city-key', '');
    var countyName = document.createElement('span');
    countyName.className = 'city-dropdown-item-name';
    countyName.textContent = 'Alameda County';
    var countyStats = document.createElement('span');
    countyStats.className = 'city-dropdown-item-stats';
    if (countyTotals.total > 0) {
        countyStats.textContent = 'Yes – ' + countyTotals.yesPct.toFixed(1) + '%';
    }
    countyItem.appendChild(countyName);
    countyItem.appendChild(countyStats);
    countyItem.addEventListener('click', function(e) {
        e.stopPropagation();
        selectCity(null);
    });
    dropdownContent.appendChild(countyItem);
    
    // Add each city
    cities.forEach(function(city) {
        var cityItem = document.createElement('div');
        cityItem.className = 'city-dropdown-item';
        cityItem.setAttribute('data-city-key', city.key);
        var cityName = document.createElement('span');
        cityName.className = 'city-dropdown-item-name';
        cityName.textContent = city.name;
        var cityStatsEl = document.createElement('span');
        cityStatsEl.className = 'city-dropdown-item-stats';
        if (city.yesPct > 0) {
            cityStatsEl.textContent = 'Yes – ' + city.yesPct.toFixed(1) + '%';
        }
        cityItem.appendChild(cityName);
        cityItem.appendChild(cityStatsEl);
        cityItem.addEventListener('click', function(e) {
            e.stopPropagation();
            selectCity(city.key);
        });
        dropdownContent.appendChild(cityItem);
    });
}

// Toggle city dropdown
function toggleCityDropdown() {
    var dropdown = document.getElementById('city-dropdown');
    if (!dropdown) return;
    
    cityDropdownOpen = !cityDropdownOpen;
    dropdown.style.display = cityDropdownOpen ? 'block' : 'none';
    
    // Close dropdown when clicking outside
    if (cityDropdownOpen) {
        // Remove existing handler if any
        if (cityDropdownCloseHandler) {
            document.removeEventListener('click', cityDropdownCloseHandler, true);
            cityDropdownCloseHandler = null;
        }
        
        setTimeout(function() {
            cityDropdownCloseHandler = function(e) {
                var btn = document.getElementById('city-selector-btn');
                var dropdownEl = document.getElementById('city-dropdown');
                if (btn && dropdownEl && !btn.contains(e.target) && !dropdownEl.contains(e.target)) {
                    cityDropdownOpen = false;
                    dropdown.style.display = 'none';
                    document.removeEventListener('click', cityDropdownCloseHandler, true);
                    cityDropdownCloseHandler = null;
                }
            };
            // Use capture phase to catch clicks before they bubble
            document.addEventListener('click', cityDropdownCloseHandler, true);
        }, 100);
    } else {
        // Remove handler when closing dropdown
        if (cityDropdownCloseHandler) {
            document.removeEventListener('click', cityDropdownCloseHandler, true);
            cityDropdownCloseHandler = null;
        }
    }
}

// Make toggleCityDropdown globally accessible
window.toggleCityDropdown = toggleCityDropdown;

// Select a city
function selectCity(cityKey) {
    cityDropdownOpen = false;
    var dropdown = document.getElementById('city-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Clean up close handler
    if (cityDropdownCloseHandler) {
        document.removeEventListener('click', cityDropdownCloseHandler, true);
        cityDropdownCloseHandler = null;
    }
    
    if (!cityKey) {
        // Clear city selection - show all precincts
        selectedPrecincts.forEach(function(item) {
            if (item.layer && item.feature) {
                var props = item.feature.properties;
                var yesPct = getYesPercentage(props);
                resetLayerStyle(item.layer, yesPct);
            }
        });
        selectedPrecincts = [];
        currentCityName = null;
        updateCityButtonText();
        updateURL();
        updateInfoSection(null);
        
        // Fit to all districts
        if (baseDistrictBounds && baseDistrictBounds.isValid()) {
            var isMobile = window.innerWidth <= 768;
            var bottomPanel = document.getElementById('bottom-panel');
            var bottomPadding = bottomPanel ? bottomPanel.offsetHeight + (isMobile ? 140 : 80) : (isMobile ? 360 : 240);
            map.fitBounds(baseDistrictBounds, {
                paddingTopLeft: L.point(20, 20),
                paddingBottomRight: L.point(20, bottomPadding)
            });
            applyMobileVerticalBias();
        }
        return;
    }
    
    // Navigate to city
    var hashParams = parseHashParams();
    hashParams.city = cityKey;
    delete hashParams.precincts; // Clear precincts when selecting city
    var newHash = buildHashParams(hashParams);
    window.location.hash = newHash;
    
    // restoreSelectionFromURL will handle the rest
    restoreSelectionFromURL();
}

// Make selectCity globally accessible
window.selectCity = selectCity;

// Update city button text
function updateCityButtonText() {
    var btn = document.getElementById('city-selector-btn');
    if (!btn) return;
    
    if (currentCityName) {
        // Don't say "City" for unincorporated areas
        var isUnincorporated = currentCityName.toLowerCase() === 'unincorporated alameda county';
        if (isUnincorporated) {
            btn.textContent = currentCityName;
        } else {
            btn.textContent = 'City – ' + currentCityName;
        }
    } else {
        btn.textContent = 'City – Alameda County';
    }
}

// Utility: On mobile, bias the map's visual center to 33% from the top
function applyMobileVerticalBias() {
    if (!map) return;
    var size = map.getSize();
    var desiredFractionFromTop = 0.33; // 33% down from top
    var deltaY = (0.5 - desiredFractionFromTop) * size.y; // positive means move up
    var isMobile = window.innerWidth <= 768;
    var extraPixels = isMobile ? 50 : 0; // only apply extra physical pan on mobile
    if (isMobile) {
        map.panBy([0, -(deltaY + extraPixels)], { animate: false });
    }
}

// Utility: On desktop, apply a simple default upward bias
function applyDesktopDefaultBiasIfNeeded() {
    if (!map) return;
    var isMobile = window.innerWidth <= 768;
    if (isMobile) return; // desktop only
    var DEFAULT_DESKTOP_BIAS_PX = 200; // shift up by 200px by default
    map.panBy([0, -DEFAULT_DESKTOP_BIAS_PX], { animate: false });
}

