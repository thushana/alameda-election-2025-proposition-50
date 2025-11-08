// ============================================================================
// SHARED STATE
// ============================================================================

import type { Map, GeoJSON as LeafletGeoJSON, LatLngBounds } from 'leaflet';
import type { SelectedPrecinct, CityStats, CountyTotals } from './types.js';

// State object - all state is mutable through this object
export const state = {
  // Map instance (will be initialized in map-init.ts)
  map: null as Map | null,

  // GeoJSON layer (will be initialized in data-loading.ts)
  geojsonLayer: null as LeafletGeoJSON | null,

  // Selected precincts for aggregation
  selectedPrecincts: [] as SelectedPrecinct[],

  currentCityName: null as string | null,

  voteMethodSectionExpanded: false,

  cityDropdownCloseHandler: null as ((e: MouseEvent) => void) | null, // Store close handler reference for cleanup

  cityStats: {} as CityStats, // Cache for city statistics

  cityDropdownOpen: false,

  // Stable geographic bounds derived from precinct polygons (never circles)
  baseDistrictBounds: null as LatLngBounds | null,

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
  } as CountyTotals
};

