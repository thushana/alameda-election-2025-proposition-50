// ============================================================================
// CITY HELPERS
// ============================================================================
// Helper function to normalize city name for URL (lowercase, spaces/underscores to hyphens - kebab-case)
// Rewrites snake_case to kebab-case
export function normalizeCityName(cityName) {
    if (!cityName)
        return null;
    // Convert to lowercase, then replace spaces and underscores with hyphens (kebab-case)
    return cityName.toLowerCase().replace(/[\s_]+/g, '-');
}
// Helper function to denormalize city name from URL (supports both hyphens and underscores, capitalize first letter)
export function denormalizeCityName(normalizedCityName) {
    if (!normalizedCityName)
        return null;
    // Replace both hyphens and underscores with spaces for backwards compatibility
    return normalizedCityName.replace(/[-_]/g, ' ').split(' ').map(function (word) {
        return word.charAt(0).toUpperCase() + word.slice(1);
    }).join(' ');
}
// Helper function to get display city name (treats "Alameda County" as "Unincorporated Alameda County")
export function getDisplayCityName(city) {
    if (!city)
        return null;
    // Treat "Alameda County" as "Unincorporated Alameda County" for city stats
    // (The county-wide "Alameda County" option at top shows all precincts combined)
    if (city.toLowerCase() === 'alameda county') {
        return 'Unincorporated Alameda County';
    }
    return city;
}
