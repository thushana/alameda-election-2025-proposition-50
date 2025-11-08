// ============================================================================
// MAP STYLING
// ============================================================================

import type { CircleMarker, PathOptions } from 'leaflet';
import { COLORS, OPACITY } from './constants.js';
import { getYesPercentage, getVoteCount } from './data-helpers.js';
import type { FeatureProperties, GeoJSONFeature } from './types.js';

import { maxVotes } from './map-mode.js';

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

// Color scale for YES percentage
// 0-50% as red shades, 50-100% as green shades
export function getColor(yesPct: number | null | undefined): string {
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
export function style(feature: GeoJSONFeature): PathOptions {
  const props = feature.properties;
  const yesPct = getYesPercentage(props);
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
export function setCircleStyle(circle: CircleMarker, yesPct: number | null, voteCount: number, isSelected: boolean): void {
  const style: any = {
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
export function setPolygonStyle(layer: any, yesPct: number | null, isSelected: boolean): void {
  const style: PathOptions = {
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
export function resetLayerStyle(layer: any, yesPct: number | null): void {
  if (layer instanceof (window as any).L.CircleMarker) {
    const voteCount = getVoteCount((layer as CircleMarker & { feature: { properties: FeatureProperties } }).feature.properties);
    setCircleStyle(layer as CircleMarker, yesPct, voteCount, false);
  } else {
    setPolygonStyle(layer, yesPct, false);
  }
}

