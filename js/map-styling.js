// ============================================================================
// MAP STYLING
// ============================================================================

// Calculate circle radius based on vote count
// Note: maxVotes is defined in map-mode.js and will be set when data loads
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

