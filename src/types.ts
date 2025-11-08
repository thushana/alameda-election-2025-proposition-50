// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

// Leaflet types are imported where needed

export interface Colors {
  NO_DATA: string;
  RED_SHADE: string;
  GREEN_100: string;
  GREEN_95: string;
  GREEN_90: string;
  GREEN_85: string;
  GREEN_80: string;
  GREEN_75: string;
  GREEN_50: string;
  BORDER_NO_DATA: string;
  BORDER_DEFAULT: string;
  BORDER_HOVER: string;
  BORDER_SELECTED: string;
  YES: string;
  NO: string;
  METHOD_MAIL_IN: string;
  METHOD_IN_PERSON: string;
}

export interface Sizes {
  BAR_GRAPH_HEIGHT: string;
  BAR_GRAPH_BORDER_RADIUS: string;
  FONT_LARGE: string;
  FONT_MEDIUM: string;
  FONT_SMALL: string;
  FONT_XSMALL: string;
  MARGIN_BOTTOM_SMALL: string;
  MARGIN_BOTTOM_MEDIUM: string;
  MARGIN_TOP_SECTION: string;
}

export interface Opacity {
  FILL_DEFAULT: number;
  FILL_HOVER: number;
  FILL_SELECTED: number;
  BACKGROUND_LIGHT: string;
  TEXT_PRIMARY: string;
  TEXT_SECONDARY: string;
  BORDER_LIGHT: string;
}

export interface Votes {
  yes: number;
  no: number;
  total: number;
}

export interface Percentage {
  yes: number;
  no: number;
}

export interface VoteMethodVotes {
  votes: Votes;
  percentage: Percentage;
  percentage_of_total: number;
}

export interface VoteMethod {
  mail_in: VoteMethodVotes;
  in_person: VoteMethodVotes;
}

export interface FeatureProperties {
  Precinct_ID?: string | number;
  precinct?: string | number;
  ID?: string | number;
  city?: string;
  neighborhood?: string;
  votes?: Votes;
  percentage?: Percentage;
  vote_method?: VoteMethod;
  aggregated?: boolean;
  count?: number;
  cityName?: string;
}

export interface GeoJSONFeature {
  type: 'Feature';
  geometry: any; // GeoJSON.Geometry
  properties: FeatureProperties;
}

export interface GeoJSONData {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

export interface SelectedPrecinct {
  feature: GeoJSONFeature;
  layer: any; // Layer from Leaflet
}

export interface CityStats {
  [key: string]: {
    name: string;
    yes: number;
    no: number;
    total: number;
    yesPct: number;
  };
}

export interface CountyTotals {
  yes: number;
  no: number;
  total: number;
  yesPct: number;
  noPct: number;
  mailInTotal: number;
  mailInYes: number;
  mailInNo: number;
  mailInYesPct: number;
  mailInPctOfTotal: number;
  inPersonTotal: number;
  inPersonYes: number;
  inPersonNo: number;
  inPersonYesPct: number;
}

export interface HashParams {
  mode: 'shaded' | 'proportional' | null;
  city: string | null;
  precincts: string | null;
}

export interface VoteData {
  hasVotes: boolean;
  yesPct: number;
  yesVotes: number;
  noPct: number;
  noVotes: number;
  totalVotes: number;
}

export interface VoteMethodBarGraphConfig {
  yesPct: number;
  noPct: number;
  totalVotes: number;
  label: string;
  countyAvgPct?: number;
  yesColor?: string;
  noColor?: string;
}

export interface MethodBreakdownBarGraphConfig {
  mailInPct: number;
  inPersonPct: number;
  totalVotes: number;
  countyAvgPct?: number;
  mailInColor?: string;
  inPersonColor?: string;
}

export type MapMode = 'shaded' | 'proportional';

