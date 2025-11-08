// ============================================================================
// SHARED STATE
// ============================================================================

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

// GeoJSON layer (will be initialized in data-loading.js)
var geojsonLayer = null;

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

