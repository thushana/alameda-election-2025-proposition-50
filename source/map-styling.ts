// ============================================================================
// MAP STYLING
// ============================================================================

import type { CircleMarker, PathOptions } from 'leaflet';
import { COLORS, MULTI_LEADER_PALETTE, OPACITY } from './constants.js';
import {
  getLeadingCandidateId,
  getVoteCount,
  getYesPercentage,
  isYesNoContest,
} from './data-helpers.js';
import type { FeatureProperties, GeoJSONFeature } from './types.js';

import { maxVotes } from './map-mode.js';
import { state } from './state.js';

// Calculate circle radius based on vote count
export function getCircleRadius(voteCount: number): number {
  if (!voteCount || voteCount === 0 || maxVotes === 0) {
    return 2; // Minimum radius
  }
  // Scale from 2px to 30px based on vote count
  const minRadius = 2;
  const maxRadius = 30;
  const ratio = voteCount / maxVotes;
  return minRadius + (maxRadius - minRadius) * Math.sqrt(ratio); // Use sqrt for better visual scaling
}

// Calculate stroke weight based on zoom level
// At higher zoom levels, use thinner strokes to avoid obfuscating shapes
export function getStrokeWeight(isSelected: boolean, zoom?: number | null): number {
  // Get zoom from map if not provided
  const currentZoom = zoom ?? (state.map ? state.map.getZoom() : 10);

  // Base weights
  const baseWeight = isSelected ? 4 : 1;

  // At higher zoom levels (15+), reduce weight significantly
  // At medium zoom (12-14), reduce slightly
  // At lower zoom (<12), use base weight
  if (currentZoom >= 15) {
    // High zoom: very thin strokes
    return isSelected ? 1.5 : 0.5;
  } else if (currentZoom >= 12) {
    // Medium zoom: slightly thinner
    return isSelected ? 2.5 : 0.75;
  } else {
    // Low zoom: base weights
    return baseWeight;
  }
}

// Color scale for YES percentage (binary YES/NO contests only)
// 0-50% as red shades, 50-100% as green shades
export function getColor(yesPct: number | null | undefined): string {
  return getYesNoIntensityColor(yesPct);
}

export function getYesNoIntensityColor(yesPct: number | null | undefined): string {
  if (yesPct === null || yesPct === undefined || yesPct === 0) {
    return COLORS.NO_DATA;
  }
  // 1-50% as single red shade
  if (yesPct <= 50) {
    return COLORS.RED_SHADE;
  }
  // Split 50-100% into 6 green steps
  return yesPct >= 100
    ? COLORS.GREEN_100
    : yesPct >= 95
      ? COLORS.GREEN_95
      : yesPct >= 90
        ? COLORS.GREEN_90
        : yesPct >= 85
          ? COLORS.GREEN_85
          : yesPct >= 80
            ? COLORS.GREEN_80
            : yesPct >= 75
              ? COLORS.GREEN_75
              : COLORS.GREEN_50;
}

/** Whether the precinct has vote data for the active visualization */
export function hasPrecinctVoteData(props: FeatureProperties): boolean {
  if (state.selectedContestId && props.contests?.[state.selectedContestId]) {
    return props.contests[state.selectedContestId].totalVotes > 0;
  }
  const yesPct = getYesPercentage(props);
  return yesPct !== null && yesPct !== undefined;
}

/** Fill color for choropleth / bubbles: YES/NO ramp or leader hue for multi-candidate contests */
export function getPrecinctFillColor(props: FeatureProperties): string {
  if (!state.selectedContestId || !props.contests?.[state.selectedContestId]) {
    const yesPct =
      props.percentage && props.percentage.yes !== undefined ? props.percentage.yes : null;
    return getYesNoIntensityColor(yesPct);
  }

  const contest = props.contests[state.selectedContestId];
  if (!contest || contest.totalVotes <= 0) {
    return COLORS.NO_DATA;
  }

  if (state.mapUsesMultiCandidateColors && !isYesNoContest(contest)) {
    const leaderId = getLeadingCandidateId(contest);
    if (leaderId === null) return COLORS.NO_DATA;
    const idx = state.multiCandidateColorOrder?.indexOf(leaderId) ?? -1;
    if (idx < 0) return COLORS.NO_DATA;
    return MULTI_LEADER_PALETTE[idx % MULTI_LEADER_PALETTE.length];
  }

  const yesPct = getYesPercentage(props);
  return getYesNoIntensityColor(yesPct);
}

// Style function
export function style(feature: GeoJSONFeature): PathOptions {
  const props = feature.properties;
  const fillColor = getPrecinctFillColor(props);
  const hasData = hasPrecinctVoteData(props);
  return {
    fillColor,
    weight: getStrokeWeight(false),
    opacity: 1,
    color: hasData ? COLORS.BORDER_DEFAULT : COLORS.BORDER_NO_DATA,
    dashArray: hasData ? '3' : '5,5',
    fillOpacity: OPACITY.FILL_DEFAULT,
  };
}

// Helper function to set circle style
export function setCircleStyle(
  circle: CircleMarker,
  props: FeatureProperties,
  voteCount: number,
  isSelected: boolean
): void {
  const fillColor = getPrecinctFillColor(props);
  const styleOpts: {
    radius: number;
    fillColor: string;
    color: string;
    weight: number;
    opacity: number;
    fillOpacity: number;
  } = {
    radius: getCircleRadius(voteCount),
    fillColor,
    fillOpacity: isSelected ? OPACITY.FILL_SELECTED : OPACITY.FILL_DEFAULT,
    weight: isSelected ? 3 : 1,
    color: isSelected ? COLORS.BORDER_SELECTED : COLORS.BORDER_DEFAULT,
    opacity: 0.8,
  };
  circle.setStyle(styleOpts);
}

// Helper function to set polygon style
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet layer API
export function setPolygonStyle(layer: any, props: FeatureProperties, isSelected: boolean): void {
  const fillColor = getPrecinctFillColor(props);
  const hasData = hasPrecinctVoteData(props);
  const styleOpts: PathOptions = {
    fillColor,
    fillOpacity: isSelected ? OPACITY.FILL_SELECTED : OPACITY.FILL_DEFAULT,
    weight: getStrokeWeight(isSelected),
    color: isSelected
      ? COLORS.BORDER_SELECTED
      : hasData
        ? COLORS.BORDER_DEFAULT
        : COLORS.BORDER_NO_DATA,
    dashArray: isSelected ? '' : hasData ? '3' : '5,5',
    opacity: 1,
  };
  layer.setStyle(styleOpts);
}

// Helper function to reset layer style (for polygons)
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet layer API
export function resetLayerStyle(layer: any): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet global API
  if (layer instanceof (window as any).L.CircleMarker) {
    const feature = (layer as CircleMarker & { feature: { properties: FeatureProperties } })
      .feature;
    const props = feature?.properties ?? {};
    const voteCount = getVoteCount(props);
    setCircleStyle(layer as CircleMarker, props, voteCount, false);
  } else {
    const feature = layer.feature as GeoJSONFeature | undefined;
    const props = feature?.properties ?? {};
    setPolygonStyle(layer, props, false);
  }
}
