// ============================================================================
// DATA HELPERS
// ============================================================================

import type { FeatureProperties, GeoJSONFeature } from './types.js';

// Helper function to extract precinct ID from properties
export function getPrecinctId(props: FeatureProperties): string | number | null {
  return (
    props.Precinct_ID ||
    props['Precinct_ID'] ||
    props.precinct ||
    props['precinct'] ||
    props.ID ||
    props['ID'] ||
    null
  );
}

// Helper function to get yes percentage from properties
export function getYesPercentage(props: FeatureProperties): number | null {
  return props.percentage && props.percentage.yes !== undefined ? props.percentage.yes : null;
}

// Helper function to get vote count from properties
export function getVoteCount(props: FeatureProperties): number {
  return props.votes && props.votes.total ? props.votes.total : 0;
}

// Helper function to safely get a value or return default
export function safeGet<T>(
  obj: Record<string, unknown> | null | undefined | { [key: string]: unknown } | unknown,
  path: string,
  defaultValue: T
): T {
  if (!obj || typeof obj !== 'object') return defaultValue;
  const keys = path.split('.');
  let current: unknown = obj;
  for (let i = 0; i < keys.length; i++) {
    if (current === null || current === undefined || typeof current !== 'object') {
      return defaultValue;
    }
    current = (current as Record<string, unknown>)[keys[i]];
    if (current === null || current === undefined) {
      return defaultValue;
    }
  }
  return current as T;
}

// Get centroid of a feature
export function getCentroid(feature: GeoJSONFeature): [number, number] | null {
  if (!feature.geometry) return null;

  // Use Leaflet's built-in method if available, otherwise calculate manually
  if (
    feature.geometry.type === 'Polygon' ||
    feature.geometry.type === 'MultiPolygon' ||
    feature.geometry.type === 'Point' ||
    feature.geometry.type === 'LineString' ||
    feature.geometry.type === 'MultiLineString' ||
    feature.geometry.type === 'MultiPoint'
  ) {
    const coords = (feature.geometry as { coordinates: unknown }).coordinates;
    let lng = 0,
      lat = 0,
      count = 0;

    function processCoordinates(coords: unknown): void {
      if (!Array.isArray(coords)) return;

      // Check if this is a coordinate pair [lng, lat]
      if (coords.length >= 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
        lng += coords[0] as number;
        lat += coords[1] as number;
        count++;
        return;
      }

      // Otherwise, it's a nested array - recurse
      if (Array.isArray(coords[0])) {
        (coords as unknown[]).forEach((item: unknown) => {
          processCoordinates(item);
        });
      }
    }

    if (feature.geometry.type === 'Polygon') {
      const polygonCoords = coords as number[][][];
      if (polygonCoords && polygonCoords[0]) {
        // Process outer ring (first ring)
        processCoordinates(polygonCoords[0]);
      }
    } else if (feature.geometry.type === 'MultiPolygon') {
      const multiPolygonCoords = coords as number[][][][];
      if (multiPolygonCoords) {
        multiPolygonCoords.forEach((polygon: number[][][]) => {
          if (polygon && polygon[0]) {
            // Process outer ring of each polygon
            processCoordinates(polygon[0]);
          }
        });
      }
    } else if (feature.geometry.type === 'Point') {
      const pointCoords = coords as number[];
      if (pointCoords && pointCoords.length >= 2) {
        lng = pointCoords[0];
        lat = pointCoords[1];
        count = 1;
      }
    } else if (feature.geometry.type === 'LineString' || feature.geometry.type === 'MultiPoint') {
      const lineCoords = coords as number[][];
      if (lineCoords) {
        processCoordinates(lineCoords);
      }
    } else if (feature.geometry.type === 'MultiLineString') {
      const multiLineCoords = coords as number[][][];
      if (multiLineCoords) {
        processCoordinates(multiLineCoords);
      }
    }

    // Return as [lat, lng] for Leaflet
    return count > 0 ? [lat / count, lng / count] : null;
  }
  return null;
}
