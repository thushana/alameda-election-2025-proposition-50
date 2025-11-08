#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GeoJSON types
type Point = [number, number]; // [lng, lat]
type PointLatLng = [number, number]; // [lat, lng]
type Ring = Point[]; // Array of [lng, lat]
type Segment = [Point, Point];

interface NominatimAddress {
  neighbourhood?: string;
  suburb?: string;
  village?: string;
  city_district?: string;
  quarter?: string;
  residential?: string;
  district?: string;
  region?: string;
  city?: string;
  town?: string;
  municipality?: string;
  county?: string;
  house_number?: string;
  road?: string;
  postcode?: string;
  country?: string;
  country_code?: string;
  'ISO3166-2-lvl4'?: string;
  [key: string]: string | undefined;
}

interface NominatimResponse {
  address?: NominatimAddress;
  error?: string;
}

interface GeocodeResult {
  neighborhood: string | null;
  city: string | null;
  rawAddress: NominatimAddress | null;
}

interface FeatureProperties {
  Precinct_ID?: string;
  precinct?: string;
  ID?: string;
  neighborhood?: string;
  city?: string;
  [key: string]: string | undefined;
}

interface GeoJSONFeature {
  type: 'Feature';
  geometry: {
    type: 'Polygon' | 'MultiPolygon';
    coordinates: Ring[] | Ring[][];
  };
  properties: FeatureProperties;
}

interface GeoJSON {
  type: 'FeatureCollection';
  features: GeoJSONFeature[];
}

// Rate limiting: 1 request per second
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Calculate distance from a point to a line segment
// point is [lat, lng], segment is [[lng1, lat1], [lng2, lat2]]
function pointToSegmentDistance(point: PointLatLng, segment: Segment): number {
  const [plat, plng] = point;
  const [[x1, y1], [x2, y2]] = segment;

  const A = plng - x1;
  const B = plat - y1;
  const C = x2 - x1;
  const D = y2 - y1;

  const dot = A * C + B * D;
  const lenSq = C * C + D * D;
  let param = -1;

  if (lenSq !== 0) {
    param = dot / lenSq;
  }

  let xx: number;
  let yy: number;

  if (param < 0) {
    xx = x1;
    yy = y1;
  } else if (param > 1) {
    xx = x2;
    yy = y2;
  } else {
    xx = x1 + param * C;
    yy = y1 + param * D;
  }

  const dx = plng - xx;
  const dy = plat - yy;
  return Math.sqrt(dx * dx + dy * dy);
}

// Calculate distance from a point to the nearest edge of a polygon
// point is [lat, lng], ring is array of [lng, lat]
function distanceToPolygon(point: PointLatLng, ring: Ring): number {
  let minDist = Infinity;

  for (let i = 0; i < ring.length - 1; i++) {
    const segment: Segment = [ring[i], ring[i + 1]];
    const dist = pointToSegmentDistance(point, segment);
    minDist = Math.min(minDist, dist);
  }

  return minDist;
}

// Find pole of inaccessibility (point furthest from any edge)
// Uses grid-based search with refinement
// ring is array of [lng, lat]
function findPoleOfInaccessibility(ring: Ring, _precision = 0.0001): PointLatLng | null {
  if (ring.length < 3) return null;

  // Get bounding box
  let minLng = ring[0][0];
  let maxLng = ring[0][0];
  let minLat = ring[0][1];
  let maxLat = ring[0][1];

  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  // Initial grid search (coarse)
  const gridSize = 10;
  let bestPoint: PointLatLng | null = null;
  let maxDist = -1;

  const lngStep = (maxLng - minLng) / gridSize;
  const latStep = (maxLat - minLat) / gridSize;

  for (let i = 0; i <= gridSize; i++) {
    for (let j = 0; j <= gridSize; j++) {
      const lng = minLng + i * lngStep;
      const lat = minLat + j * latStep;
      const point: PointLatLng = [lat, lng];

      // Only check points inside polygon
      if (isPointInPolygon(point, ring)) {
        const dist = distanceToPolygon(point, ring);
        if (dist > maxDist) {
          maxDist = dist;
          bestPoint = point;
        }
      }
    }
  }

  if (!bestPoint) {
    // No point found in initial grid, fallback to bounding box center
    const bboxCenter: PointLatLng = [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
    if (isPointInPolygon(bboxCenter, ring)) {
      return bboxCenter;
    }
    return findInteriorPoint(ring);
  }

  // Refinement: search around best point with finer grid
  const refineSize = 5;
  const refineRange = Math.max(lngStep, latStep) * 0.5;

  const refineLngStep = (2 * refineRange) / refineSize;
  const refineLatStep = (2 * refineRange) / refineSize;

  const [bestLat, bestLng] = bestPoint;

  for (let i = 0; i <= refineSize; i++) {
    for (let j = 0; j <= refineSize; j++) {
      const lng = bestLng - refineRange + i * refineLngStep;
      const lat = bestLat - refineRange + j * refineLatStep;

      // Clamp to bounding box
      if (lng < minLng || lng > maxLng || lat < minLat || lat > maxLat) continue;

      const point: PointLatLng = [lat, lng];
      if (isPointInPolygon(point, ring)) {
        const dist = distanceToPolygon(point, ring);
        if (dist > maxDist) {
          maxDist = dist;
          bestPoint = point;
        }
      }
    }
  }

  return bestPoint;
}

// Point-in-polygon check using ray casting algorithm
function isPointInPolygon(point: PointLatLng, ring: Ring): boolean {
  // point is [lat, lng], ring is array of [lng, lat]
  const [lat, lng] = point;
  let inside = false;

  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];

    // Ray casting: check if point crosses edge
    const intersect = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

// Get bounding box center
function getBoundingBoxCenter(ring: Ring): PointLatLng | null {
  // ring is array of [lng, lat]
  if (ring.length === 0) return null;

  let minLng = ring[0][0];
  let maxLng = ring[0][0];
  let minLat = ring[0][1];
  let maxLat = ring[0][1];

  for (const [lng, lat] of ring) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }

  return [(minLat + maxLat) / 2, (minLng + maxLng) / 2];
}

// Find an interior point (fallback when centroid is outside)
function findInteriorPoint(ring: Ring): PointLatLng | null {
  // Try bounding box center first
  const bboxCenter = getBoundingBoxCenter(ring);
  if (bboxCenter && isPointInPolygon(bboxCenter, ring)) {
    return bboxCenter;
  }

  // Find midpoint of longest edge
  let maxDist = 0;
  let bestPoint: PointLatLng | null = null;

  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const dist = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));

    if (dist > maxDist) {
      maxDist = dist;
      // Midpoint of edge
      const midLng = (x1 + x2) / 2;
      const midLat = (y1 + y2) / 2;
      bestPoint = [midLat, midLng];
    }
  }

  // If midpoint is inside, use it; otherwise use first vertex
  if (bestPoint && isPointInPolygon(bestPoint, ring)) {
    return bestPoint;
  }

  // Last resort: use first vertex (should be on boundary)
  if (ring.length > 0) {
    return [ring[0][1], ring[0][0]];
  }

  return null;
}

// Calculate centroid of a feature using pole of inaccessibility
function getCentroid(feature: GeoJSONFeature): PointLatLng | null {
  if (!feature.geometry || !feature.geometry.coordinates) {
    return null;
  }

  const geometry = feature.geometry;

  if (geometry.type === 'Polygon') {
    const outerRing = geometry.coordinates[0] as Ring; // Outer ring: array of [lng, lat]

    // Use pole of inaccessibility (point furthest from any edge)
    const pole = findPoleOfInaccessibility(outerRing);

    if (pole) {
      return pole;
    }

    // Fallback to interior point if pole calculation fails
    return findInteriorPoint(outerRing);
  } else if (geometry.type === 'MultiPolygon') {
    // For MultiPolygon: find pole of inaccessibility for each polygon,
    // then use the one with maximum distance to edge
    const polygons = geometry.coordinates as Ring[][];
    let bestPole: PointLatLng | null = null;
    let maxDist = -1;

    for (const polygon of polygons) {
      const outerRing = polygon[0] as Ring; // Outer ring of each polygon
      const pole = findPoleOfInaccessibility(outerRing);

      if (pole) {
        const dist = distanceToPolygon(pole, outerRing);
        if (dist > maxDist) {
          maxDist = dist;
          bestPole = pole;
        }
      }
    }

    if (bestPole) {
      return bestPole;
    }

    // Fallback: use first polygon's interior point
    if (polygons.length > 0 && polygons[0].length > 0) {
      return findInteriorPoint(polygons[0][0] as Ring);
    }

    return null;
  }

  return null;
}

// Helper function to extract precinct ID from properties
function getPrecinctId(props: FeatureProperties): string | null {
  // Check both camelCase and string literal keys
  return (
    props?.Precinct_ID ||
    (props as Record<string, string | undefined>)?.['Precinct_ID'] ||
    props?.precinct ||
    (props as Record<string, string | undefined>)?.['precinct'] ||
    props?.ID ||
    (props as Record<string, string | undefined>)?.['ID'] ||
    null
  );
}

// Get neighborhood name and city from coordinates using Nominatim
async function getNeighborhoodAndCity(lat: number, lng: number): Promise<GeocodeResult> {
  const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Alameda Election Map Enrichment Script', // Nominatim requires a User-Agent
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = (await response.json()) as NominatimResponse;
    const address = data.address || {};

    // Extract neighborhood (try different fields in order of preference)
    // First try standard neighborhood fields
    let neighborhood =
      address.neighbourhood ||
      address.suburb ||
      address.village ||
      address.city_district ||
      address.quarter ||
      null;

    // If no neighborhood found, try fallback fields
    if (!neighborhood) {
      // Try residential, district, or region fields
      neighborhood = address.residential || address.district || address.region || null;
    }

    // Note: Road name parsing removed - too location-specific
    // If you need neighborhood extraction from road names, add custom logic here

    // Extract city
    const city = address.city || address.town || address.municipality || address.county || null;

    return {
      neighborhood: neighborhood || null,
      city: city || null,
      // Also return raw address for debugging
      rawAddress: address,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.warn(`Failed to geocode [${lat}, ${lng}]:`, message);
    return {
      neighborhood: null,
      city: null,
      rawAddress: null,
    };
  }
}

// Main function
async function enrichGeoJSON(precinctIdsFilter: string[] | null = null): Promise<void> {
  // Get parent directory (project root) since script is in scripts/ folder
  const projectRoot = path.join(__dirname, '..');
  const inputFile = path.join(projectRoot, 'precincts_consolidated.geojson');
  const outputFile = path.join(projectRoot, 'precincts_consolidated.geojson');

  console.log('Reading GeoJSON file...');
  const geojsonData = fs.readFileSync(inputFile, 'utf8');
  const geojson = JSON.parse(geojsonData) as GeoJSON;

  if (!geojson.features || !Array.isArray(geojson.features)) {
    console.error('Invalid GeoJSON: missing features array');
    process.exit(1);
  }

  // Filter features if precinct IDs are specified
  let featuresToProcess = geojson.features;
  if (precinctIdsFilter && Array.isArray(precinctIdsFilter)) {
    const filterSet = new Set(precinctIdsFilter.map((id) => id.toString()));
    featuresToProcess = geojson.features.filter((feature) => {
      const precinctId = getPrecinctId(feature.properties);
      return precinctId && filterSet.has(precinctId.toString());
    });
    console.log(
      `Filtering to ${featuresToProcess.length} precincts: ${precinctIdsFilter.join(', ')}`
    );
  }

  const totalFeatures = featuresToProcess.length;
  console.log(`Found ${totalFeatures} features to process`);
  console.log('Starting enrichment (rate limited to 1 request/second)...\n');

  let processed = 0;
  let skipped = 0;
  let errors = 0;

  for (let i = 0; i < totalFeatures; i++) {
    const feature = featuresToProcess[i];
    const precinctId = getPrecinctId(feature.properties) || `feature-${i}`;

    // Re-enrich all features (don't skip already enriched ones)
    // This allows recalculating with improved algorithms like pole of inaccessibility

    // Get centroid
    const centroid = getCentroid(feature);
    if (!centroid) {
      console.log(`[${i + 1}/${totalFeatures}] Precinct ${precinctId}: No centroid, skipping`);
      skipped++;
      continue;
    }

    const [lat, lng] = centroid;
    console.log(
      `[${i + 1}/${totalFeatures}] Precinct ${precinctId}: Geocoding [${lat.toFixed(4)}, ${lng.toFixed(4)}]...`
    );

    // Get neighborhood and city
    const result = await getNeighborhoodAndCity(lat, lng);

    // Add to feature properties
    feature.properties.neighborhood = result.neighborhood || undefined;
    feature.properties.city = result.city || undefined;

    // Log available address fields for debugging (only if no neighborhood found)
    if (!result.neighborhood && result.rawAddress) {
      const availableFields = Object.keys(result.rawAddress).filter(
        (key) =>
          ![
            'house_number',
            'road',
            'postcode',
            'country',
            'country_code',
            'ISO3166-2-lvl4',
          ].includes(key)
      );
      if (availableFields.length > 0) {
        console.log(`  ⚠ No neighborhood found. Available fields: ${availableFields.join(', ')}`);
      }
    }

    if (result.neighborhood || result.city) {
      console.log(
        `  ✓ Neighborhood: ${result.neighborhood || 'N/A'}, City: ${result.city || 'N/A'}`
      );
      processed++;
    } else {
      console.log(`  ⚠ No neighborhood or city found`);
      errors++;
    }

    // Rate limit: wait 1 second between requests (Nominatim requirement)
    if (i < totalFeatures - 1) {
      await sleep(1000);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Total features: ${totalFeatures}`);
  console.log(`Processed: ${processed}`);
  console.log(`Skipped (no centroid): ${skipped}`);
  console.log(`Errors/No data: ${errors}`);

  // Save enriched GeoJSON
  console.log('\nSaving enriched GeoJSON...');
  fs.writeFileSync(outputFile, JSON.stringify(geojson, null, 2), 'utf8');
  console.log(`✓ Saved to ${outputFile}`);
}

// Run the script
// Check if this is the main module (ES modules equivalent of require.main === module)
const isMainModule =
  import.meta.url === `file://${process.argv[1]}` || import.meta.url.endsWith(process.argv[1]);

if (isMainModule) {
  // Get precinct IDs from command line args
  // If no args provided, process all precincts
  const args = process.argv.slice(2);
  const precinctIdsFilter = args.length > 0 ? args : null;

  if (precinctIdsFilter) {
    console.log(`Processing ${precinctIdsFilter.length} specified precinct(s)...\n`);
  } else {
    console.log('No precinct IDs specified, processing all precincts...\n');
  }

  enrichGeoJSON(precinctIdsFilter).catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
}

export { enrichGeoJSON, getCentroid, getNeighborhoodAndCity, getPrecinctId };
