// ============================================================================
// CITY STATISTICS
// ============================================================================

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

