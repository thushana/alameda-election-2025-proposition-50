// ============================================================================
// SHARED STATE
// ============================================================================

import type { Map, GeoJSON as LeafletGeoJSON, LatLngBounds } from 'leaflet';
import type {
  SelectedPrecinct,
  CityStats,
  CountyTotals,
  ContestInfo,
  GeoJSONData,
} from './types.js';

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

  contestDropdownCloseHandler: null as ((e: MouseEvent) => void) | null, // Store close handler reference for cleanup

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
    inPersonYesPct: 0,
  } as CountyTotals,

  // Multi-contest support
  selectedContestId: null as number | null,
  selectedElection: null as string | null, // e.g., "2024-11"
  contests: {} as Record<number, ContestInfo>,
  countyTotalsByContest: {} as Record<number, CountyTotals>,

  /** When true, map uses MULTI_LEADER_PALETTE by leading candidate instead of YES% red/green scale */
  mapUsesMultiCandidateColors: false,
  /** Candidate IDs sorted by county-wide votes (desc); palette index matches this order */
  multiCandidateColorOrder: null as number[] | null,
  multiCandidateNames: {} as Record<number, string>,

  /** Last election|contest URL signature applied by loadData (avoids skipping reload when UI updates state before hash) */
  appliedMapDataSignature: '' as string,

  /** Prevents re-entrant loadData (e.g. hash set to default city mid-load) */
  loadDataInProgress: false,

  /** If hash changes during loadData, run one more load after the current one finishes */
  loadDataPending: false,

  /** Last merged precinct GeoJSON + results (for city/county contest summaries when no hover) */
  geoJSONDataSnapshot: null as GeoJSONData | null,

  /**
   * True when the URL asked for an election-specific precinct file (e.g. precincts-2024-11.geojson)
   * but the app loaded precincts_consolidated.geojson instead. City/county contest totals then only
   * include precincts that exist in that fallback file, not the full certified jurisdiction.
   */
  precinctGeometryFallback: false,
};
