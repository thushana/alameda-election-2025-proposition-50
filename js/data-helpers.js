// ============================================================================
// DATA HELPERS
// ============================================================================
// Helper function to extract precinct ID from properties
export function getPrecinctId(props) {
    return props.Precinct_ID ||
        props['Precinct_ID'] ||
        props.precinct ||
        props['precinct'] ||
        props.ID ||
        props['ID'] ||
        null;
}
// Helper function to get yes percentage from properties
export function getYesPercentage(props) {
    return (props.percentage && props.percentage.yes !== undefined) ? props.percentage.yes : null;
}
// Helper function to get vote count from properties
export function getVoteCount(props) {
    return (props.votes && props.votes.total) ? props.votes.total : 0;
}
// Helper function to safely get a value or return default
export function safeGet(obj, path, defaultValue) {
    if (!obj || typeof obj !== 'object')
        return defaultValue;
    const keys = path.split('.');
    let current = obj;
    for (let i = 0; i < keys.length; i++) {
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
// Get centroid of a feature
export function getCentroid(feature) {
    // Use Leaflet's built-in method if available, otherwise calculate manually
    if (feature.geometry && feature.geometry.coordinates) {
        const coords = feature.geometry.coordinates;
        let lng = 0, lat = 0, count = 0;
        function processCoordinates(coords) {
            if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
                // Array of coordinates
                coords.forEach(function (coord) {
                    if (Array.isArray(coord[0])) {
                        processCoordinates(coord);
                    }
                    else {
                        // GeoJSON format: [lng, lat]
                        lng += coord[0];
                        lat += coord[1];
                        count++;
                    }
                });
            }
            else if (typeof coords[0] === 'number') {
                // Single coordinate [lng, lat]
                lng += coords[0];
                lat += coords[1];
                count++;
            }
        }
        if (feature.geometry.type === 'Polygon') {
            processCoordinates(coords[0]); // Use outer ring
        }
        else if (feature.geometry.type === 'MultiPolygon') {
            coords.forEach(function (polygon) {
                processCoordinates(polygon[0]); // Use outer ring of each polygon
            });
        }
        // Return as [lat, lng] for Leaflet
        return count > 0 ? [lat / count, lng / count] : null;
    }
    return null;
}
