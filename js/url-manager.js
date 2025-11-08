// ============================================================================
// URL MANAGER
// ============================================================================

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

