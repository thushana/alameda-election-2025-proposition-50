#!/usr/bin/env node

/**
 * Script to enrich precincts_consolidated.geojson with neighborhood names and city
 * Uses Nominatim reverse geocoding API with rate limiting (1 request/second)
 */

const fs = require('fs');
const path = require('path');

// Rate limiting: 1 request per second
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Calculate centroid of a feature
function getCentroid(feature) {
    if (!feature.geometry || !feature.geometry.coordinates) {
        return null;
    }
    
    const coords = feature.geometry.coordinates;
    let lng = 0, lat = 0, count = 0;
    
    function processCoordinates(coords) {
        if (Array.isArray(coords[0]) && typeof coords[0][0] === 'number') {
            coords.forEach(function(coord) {
                if (Array.isArray(coord[0])) {
                    processCoordinates(coord);
                } else {
                    // GeoJSON format: [lng, lat]
                    lng += coord[0];
                    lat += coord[1];
                    count++;
                }
            });
        } else if (typeof coords[0] === 'number') {
            lng += coords[0];
            lat += coords[1];
            count++;
        }
    }
    
    if (feature.geometry.type === 'Polygon') {
        processCoordinates(coords[0]); // Use outer ring
    } else if (feature.geometry.type === 'MultiPolygon') {
        coords.forEach(function(polygon) {
            processCoordinates(polygon[0]); // Use outer ring of each polygon
        });
    }
    
    return count > 0 ? [lat / count, lng / count] : null;
}

// Helper function to extract precinct ID from properties
function getPrecinctId(props) {
    return props?.Precinct_ID || 
           props?.['Precinct_ID'] || 
           props?.precinct || 
           props?.['precinct'] ||
           props?.ID || 
           props?.['ID'] || 
           null;
}

// Get neighborhood name and city from coordinates using Nominatim
async function getNeighborhoodAndCity(lat, lng) {
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
    
    try {
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Alameda Election Map Enrichment Script' // Nominatim requires a User-Agent
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const data = await response.json();
        const address = data.address || {};
        
        // Extract neighborhood (try different fields in order of preference)
        // First try standard neighborhood fields
        let neighborhood = address.neighbourhood || 
                          address.suburb || 
                          address.village || 
                          address.city_district ||
                          address.quarter ||
                          null;
        
        // If no neighborhood found, try fallback fields
        if (!neighborhood) {
            // Try residential, district, or region fields
            neighborhood = address.residential ||
                          address.district ||
                          address.region ||
                          null;
        }
        
        // Note: Road name parsing removed - too location-specific
        // If you need neighborhood extraction from road names, add custom logic here
        
        // Extract city
        const city = address.city || 
                    address.town || 
                    address.municipality ||
                    address.county ||
                    null;
        
        return {
            neighborhood: neighborhood,
            city: city,
            // Also return raw address for debugging
            rawAddress: address
        };
    } catch (error) {
        console.warn(`Failed to geocode [${lat}, ${lng}]:`, error.message);
        return {
            neighborhood: null,
            city: null,
            rawAddress: null
        };
    }
}

// Main function
async function enrichGeoJSON(precinctIdsFilter = null) {
    // Get parent directory (project root) since script is in scripts/ folder
    const projectRoot = path.join(__dirname, '..');
    const inputFile = path.join(projectRoot, 'precincts_consolidated.geojson');
    const outputFile = path.join(projectRoot, 'precincts_consolidated.geojson');
    
    console.log('Reading GeoJSON file...');
    const geojsonData = fs.readFileSync(inputFile, 'utf8');
    const geojson = JSON.parse(geojsonData);
    
    if (!geojson.features || !Array.isArray(geojson.features)) {
        console.error('Invalid GeoJSON: missing features array');
        process.exit(1);
    }
    
    // Filter features if precinct IDs are specified
    let featuresToProcess = geojson.features;
    if (precinctIdsFilter && Array.isArray(precinctIdsFilter)) {
        const filterSet = new Set(precinctIdsFilter.map(id => id.toString()));
        featuresToProcess = geojson.features.filter(feature => {
            const precinctId = getPrecinctId(feature.properties);
            return precinctId && filterSet.has(precinctId.toString());
        });
        console.log(`Filtering to ${featuresToProcess.length} precincts: ${precinctIdsFilter.join(', ')}`);
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
        
        // Check if already enriched (check for null/undefined)
        if (feature.properties.neighborhood != null && feature.properties.city != null) {
            console.log(`[${i + 1}/${totalFeatures}] Precinct ${precinctId}: Already enriched, skipping`);
            skipped++;
            continue;
        }
        
        // Get centroid
        const centroid = getCentroid(feature);
        if (!centroid) {
            console.log(`[${i + 1}/${totalFeatures}] Precinct ${precinctId}: No centroid, skipping`);
            skipped++;
            continue;
        }
        
        const [lat, lng] = centroid;
        console.log(`[${i + 1}/${totalFeatures}] Precinct ${precinctId}: Geocoding [${lat.toFixed(4)}, ${lng.toFixed(4)}]...`);
        
        // Get neighborhood and city
        const result = await getNeighborhoodAndCity(lat, lng);
        
        // Add to feature properties
        feature.properties.neighborhood = result.neighborhood;
        feature.properties.city = result.city;
        
        // Log available address fields for debugging (only if no neighborhood found)
        if (!result.neighborhood && result.rawAddress) {
            const availableFields = Object.keys(result.rawAddress).filter(key => 
                !['house_number', 'road', 'postcode', 'country', 'country_code', 'ISO3166-2-lvl4'].includes(key)
            );
            if (availableFields.length > 0) {
                console.log(`  ⚠ No neighborhood found. Available fields: ${availableFields.join(', ')}`);
            }
        }
        
        if (result.neighborhood || result.city) {
            console.log(`  ✓ Neighborhood: ${result.neighborhood || 'N/A'}, City: ${result.city || 'N/A'}`);
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
    console.log(`Skipped (already enriched): ${skipped}`);
    console.log(`Errors/No data: ${errors}`);
    
    // Save enriched GeoJSON
    console.log('\nSaving enriched GeoJSON...');
    fs.writeFileSync(outputFile, JSON.stringify(geojson, null, 2), 'utf8');
    console.log(`✓ Saved to ${outputFile}`);
}

// Run the script
if (require.main === module) {
    // Get precinct IDs from command line args
    // If no args provided, process all precincts
    const args = process.argv.slice(2);
    const precinctIdsFilter = args.length > 0 ? args : null;
    
    if (precinctIdsFilter) {
        console.log(`Processing ${precinctIdsFilter.length} specified precinct(s)...\n`);
    } else {
        console.log('No precinct IDs specified, processing all precincts...\n');
    }
    
    enrichGeoJSON(precinctIdsFilter).catch(error => {
        console.error('Error:', error);
        process.exit(1);
    });
}

module.exports = { enrichGeoJSON, getCentroid, getNeighborhoodAndCity, getPrecinctId };

