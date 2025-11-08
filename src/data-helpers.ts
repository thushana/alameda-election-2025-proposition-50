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
  // Use Leaflet's built-in method if available, otherwise calculate manually
  if (
    feature.geometry &&
    (feature.geometry.type === 'Polygon' ||
      feature.geometry.type === 'MultiPolygon' ||
      feature.geometry.type === 'Point' ||
      feature.geometry.type === 'LineString' ||
      feature.geometry.type === 'MultiLineString' ||
      feature.geometry.type === 'MultiPoint')
  ) {
    const coords = (feature.geometry as { coordinates: unknown }).coordinates;
    let lng = 0,
      lat = 0,
      count = 0;

    function processCoordinates(coords: unknown): void {
      if (!Array.isArray(coords)) return;
      if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
        // Array of coordinates
        (coords as number[][]).forEach(function (coord: number[]) {
          if (Array.isArray(coord[0]) && Array.isArray(coord[0][0])) {
            processCoordinates(coord);
          } else if (Array.isArray(coord[0]) && typeof coord[0] === 'number') {
            // GeoJSON format: [lng, lat]
            const coordArray = coord as number[];
            lng += coordArray[0];
            lat += coordArray[1];
            count++;
          }
        });
      } else if (typeof coords[0] === 'number') {
        // Single coordinate [lng, lat]
        const coordArray = coords as number[];
        lng += coordArray[0];
        lat += coordArray[1];
        count++;
      }
    }

    if (feature.geometry.type === 'Polygon') {
      const polygonCoords = coords as number[][][];
      processCoordinates(polygonCoords[0]); // Use outer ring
    } else if (feature.geometry.type === 'MultiPolygon') {
      const multiPolygonCoords = coords as number[][][][];
      multiPolygonCoords.forEach(function (polygon: number[][][]) {
        processCoordinates(polygon[0]); // Use outer ring of each polygon
      });
    }

    // Return as [lat, lng] for Leaflet
    return count > 0 ? [lat / count, lng / count] : null;
  }
  return null;
}
