// ============================================================================
// SHARED STATE
// ============================================================================
// State object - all state is mutable through this object
export const state = {
    // Map instance (will be initialized in map-init.ts)
    map: null,
    // GeoJSON layer (will be initialized in data-loading.ts)
    geojsonLayer: null,
    // Selected precincts for aggregation
    selectedPrecincts: [],
    currentCityName: null,
    voteMethodSectionExpanded: false,
    cityDropdownCloseHandler: null, // Store close handler reference for cleanup
    cityStats: {}, // Cache for city statistics
    cityDropdownOpen: false,
    // Stable geographic bounds derived from precinct polygons (never circles)
    baseDistrictBounds: null,
    // Guards to avoid duplicate listeners and repeated restores
    hashListenerBound: false,
    restoreInProgress: false,
    lastRestoreSignature: '',
    // County totals (will be calculated from data)
    countyTotals: {
        yes: 0,
        no: 0,
        total: 0,
        yesPct: 0,
        noPct: 0,
        mailInTotal: 0,
        mailInYes: 0,
        mailInNo: 0,
        mailInYesPct: 0,
        mailInPctOfTotal: 0,
        inPersonTotal: 0,
        inPersonYes: 0,
        inPersonNo: 0,
        inPersonYesPct: 0
    }
};
