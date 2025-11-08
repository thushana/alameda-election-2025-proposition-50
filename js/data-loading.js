// ============================================================================
// DATA LOADING
// ============================================================================

// Add GeoJSON layer (declared in state.js, initialized here)
geojsonLayer = L.geoJSON(null, {
    style: style,
    onEachFeature: onEachFeature
});

// Only add to map if in shaded mode (default is shaded)
if (mapMode === 'shaded') {
    geojsonLayer.addTo(map);
}

// Load GeoJSON data and results.json
Promise.all([
    fetch('precincts_consolidated.geojson').then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok: ' + response.status + ' ' + response.statusText);
        }
        return response.json();
    }),
    fetch('results.json').then(response => {
        if (!response.ok) {
            throw new Error('Could not load results.json: ' + response.status + ' ' + response.statusText);
        }
        return response.json();
    })
])
    .then(function(results) {
        var data = results[0];
        var resultsData = results[1];
        
        
        if (!resultsData || !Array.isArray(resultsData)) {
            throw new Error('results.json is invalid or empty');
        }
        
        // Create a map of all vote data from results.json
        var resultsMap = {};
        resultsData.forEach(function(result) {
            if (result.precinct) {
                resultsMap[result.precinct] = {
                    votes: result.votes || null,
                    percentage: result.percentage || null,
                    vote_method: result.vote_method || null
                };
            }
        });
        
        // Merge all vote data from results.json into GeoJSON features
        data.features.forEach(function(feature) {
            var precinctId = getPrecinctId(feature.properties);
            
            if (precinctId && resultsMap[precinctId.toString()]) {
                var voteData = resultsMap[precinctId.toString()];
                if (voteData.votes) {
                    feature.properties.votes = voteData.votes;
                }
                if (voteData.percentage) {
                    feature.properties.percentage = voteData.percentage;
                }
                if (voteData.vote_method) {
                    feature.properties.vote_method = voteData.vote_method;
                }
            }
        });
        
        // Calculate city statistics
        cityStats = calculateCityStats(data);
        
        // Reset county totals before calculation to prevent accumulation
        countyTotals.yes = 0;
        countyTotals.no = 0;
        countyTotals.total = 0;
        countyTotals.mailInTotal = 0;
        countyTotals.mailInYes = 0;
        countyTotals.mailInNo = 0;
        countyTotals.inPersonTotal = 0;
        countyTotals.inPersonYes = 0;
        countyTotals.inPersonNo = 0;
        
        // Calculate county totals from results.json with error handling
        try {
            resultsData.forEach(function(result) {
                if (!result) return;
                
                // Calculate overall vote totals
                if (result.votes && typeof result.votes === 'object') {
                    var votes = result.votes;
                    if (typeof votes.yes === 'number' && votes.yes > 0) {
                        countyTotals.yes += votes.yes;
                    }
                    if (typeof votes.no === 'number' && votes.no > 0) {
                        countyTotals.no += votes.no;
                    }
                    if (typeof votes.total === 'number' && votes.total > 0) {
                        countyTotals.total += votes.total;
                    }
                }
                
                // Calculate county-level vote method totals
                if (result.vote_method && typeof result.vote_method === 'object') {
                    if (result.vote_method.mail_in && result.vote_method.mail_in.votes && typeof result.vote_method.mail_in.votes === 'object') {
                        var mailInVotes = result.vote_method.mail_in.votes;
                        if (typeof mailInVotes.total === 'number' && mailInVotes.total > 0) {
                            countyTotals.mailInTotal += mailInVotes.total;
                        }
                        if (typeof mailInVotes.yes === 'number' && mailInVotes.yes > 0) {
                            countyTotals.mailInYes += mailInVotes.yes;
                        }
                        if (typeof mailInVotes.no === 'number' && mailInVotes.no > 0) {
                            countyTotals.mailInNo += mailInVotes.no;
                        }
                    }
                    if (result.vote_method.in_person && result.vote_method.in_person.votes && typeof result.vote_method.in_person.votes === 'object') {
                        var inPersonVotes = result.vote_method.in_person.votes;
                        if (typeof inPersonVotes.total === 'number' && inPersonVotes.total > 0) {
                            countyTotals.inPersonTotal += inPersonVotes.total;
                        }
                        if (typeof inPersonVotes.yes === 'number' && inPersonVotes.yes > 0) {
                            countyTotals.inPersonYes += inPersonVotes.yes;
                        }
                        if (typeof inPersonVotes.no === 'number' && inPersonVotes.no > 0) {
                            countyTotals.inPersonNo += inPersonVotes.no;
                        }
                    }
                }
            });
        } catch (error) {
            // Reset to safe defaults on error
            countyTotals.yes = 0;
            countyTotals.no = 0;
            countyTotals.total = 0;
            countyTotals.mailInTotal = 0;
            countyTotals.mailInYes = 0;
            countyTotals.mailInNo = 0;
            countyTotals.inPersonTotal = 0;
            countyTotals.inPersonYes = 0;
            countyTotals.inPersonNo = 0;
        }
        
        // Calculate percentages
        if (countyTotals.total > 0) {
            countyTotals.yesPct = (countyTotals.yes / countyTotals.total) * 100;
            countyTotals.noPct = (countyTotals.no / countyTotals.total) * 100;
        } else {
            countyTotals.yesPct = 0;
            countyTotals.noPct = 0;
        }
        
        // Calculate county-level mail-in percentage of total votes
        if (countyTotals.total > 0) {
            countyTotals.mailInPctOfTotal = (countyTotals.mailInTotal / countyTotals.total) * 100;
        } else {
            countyTotals.mailInPctOfTotal = 0;
        }
        
        // Calculate county-level mail-in YES percentage
        if (countyTotals.mailInTotal > 0) {
            countyTotals.mailInYesPct = (countyTotals.mailInYes / countyTotals.mailInTotal) * 100;
        } else {
            countyTotals.mailInYesPct = 0;
        }
        
        // Calculate county-level in-person YES percentage
        if (countyTotals.inPersonTotal > 0) {
            countyTotals.inPersonYesPct = (countyTotals.inPersonYes / countyTotals.inPersonTotal) * 100;
        } else {
            countyTotals.inPersonYesPct = 0;
        }
        
        // Build city dropdown (after county totals are calculated)
        // Only build once to avoid duplicates
        if (Object.keys(cityStats).length > 0) {
            buildCityDropdown();
        }
        
        // Add data based on current mode
        if (mapMode === 'proportional') {
            createProportionalSymbols(data);
            // Also add to geojsonLayer for selection/restore functionality
            geojsonLayer.addData(data);
            geojsonLayer.removeFrom(map); // Hide polygons, show circles
        } else {
            geojsonLayer.addData(data);
        }
        
        // Fit bounds
        // Establish stable geographic bounds from polygon geometry only (circles can extend beyond)
        if (!baseDistrictBounds && geojsonLayer.getBounds && geojsonLayer.getBounds().isValid()) {
            baseDistrictBounds = geojsonLayer.getBounds();
        }
        
        // Check if city/precincts are in URL - if so, fit to those instead of all districts
        var hashParams = parseHashParams();
        var precinctIds = [];
        var boundsToFit = null;
        
        if (hashParams.city) {
            // Find precincts by matching city property
            // Normalize city name (converts snake_case to kebab-case)
            var normalizedCityName = normalizeCityName(hashParams.city);
            
            // Rewrite URL to kebab-case if it was snake_case
            if (hashParams.city !== normalizedCityName) {
                hashParams.city = normalizedCityName;
                var newHash = buildHashParams(hashParams);
                window.location.hash = newHash;
            }
            
            // Calculate bounds of precincts matching the city
            var selectedBounds = L.latLngBounds([]);
            geojsonLayer.eachLayer(function(layer) {
                var feature = layer.feature;
                if (!feature) return;
                var props = feature.properties;
                var featureCity = safeGet(props, 'city', null);
                
                // Get display city name (treats "Alameda County" as "Unincorporated Alameda County")
                var displayCity = getDisplayCityName(featureCity);
                
                var normalizedFeatureCity = normalizeCityName(displayCity);
                
                if (normalizedFeatureCity === normalizedCityName) {
                    try {
                        var tmp = L.geoJSON(feature);
                        var b = tmp.getBounds();
                        if (b && b.isValid()) selectedBounds.extend(b);
                    } catch (e) {}
                }
            });
            if (selectedBounds.isValid()) {
                boundsToFit = selectedBounds;
            }
        } else if (hashParams.precincts) {
            precinctIds = hashParams.precincts.split(/[+,]/);
            
            // Calculate bounds of selected precincts
            var selectedBounds = L.latLngBounds([]);
            geojsonLayer.eachLayer(function(layer) {
                var feature = layer.feature;
                if (!feature) return;
                var props = feature.properties;
                var precinctId = getPrecinctId(props);
                var precinctIdStr = precinctId ? precinctId.toString() : null;
                if (precinctIdStr && precinctIds.indexOf(precinctIdStr) !== -1) {
                    try {
                        var tmp = L.geoJSON(feature);
                        var b = tmp.getBounds();
                        if (b && b.isValid()) selectedBounds.extend(b);
                    } catch (e) {}
                }
            });
            if (selectedBounds.isValid()) {
                boundsToFit = selectedBounds;
            }
        }
        
        // If no selected bounds, use all districts
        if (!boundsToFit) {
            boundsToFit = baseDistrictBounds || (geojsonLayer.getBounds && geojsonLayer.getBounds().isValid() ? geojsonLayer.getBounds() : null);
        }
        
        if (boundsToFit) {
            var isMobileInit = window.innerWidth <= 768;
            var bottomPanelInit = document.getElementById('bottom-panel');
            var bottomPaddingInit = bottomPanelInit ? bottomPanelInit.offsetHeight + (isMobileInit ? 140 : 80) : (isMobileInit ? 360 : 240);
            var sidePaddingInit = isMobileInit ? 50 : 80; // Mobile: zoomed out one more level, Desktop: unchanged
            var topPaddingInit = isMobileInit ? 50 : 80; // Mobile: zoomed out one more level, Desktop: unchanged
            map.fitBounds(boundsToFit, {
                paddingTopLeft: L.point(sidePaddingInit, topPaddingInit),
                paddingBottomRight: L.point(sidePaddingInit, bottomPaddingInit)
            });
            setTimeout(function() {
                applyMobileVerticalBias();
                applyDesktopDefaultBiasIfNeeded();
            }, 100);
        }
        
        // Update info section with county totals
        updateInfoSection(null);
        
        // Update button text based on initial mode
        var btn = document.getElementById('toggle-mode-btn');
        if (btn) {
            btn.textContent = mapMode === 'proportional' ? 'Mode – Proportional Districts' : 'Mode – Shaded Districts';
        }
        
        // Restore selection from URL if present (do this first to set currentCityName)
        restoreSelectionFromURL();
        
        // Update city button text after initial load
        updateCityButtonText();
        
        // Don't set initial hash - only update URL when user actually changes mode
        // This preserves URLs like #city/alameda without adding mode/shaded/
        
        // Listen for hash changes (back/forward navigation)
        if (!hashListenerBound) {
            window.addEventListener('hashchange', function() {
                var hashParams = parseHashParams();
                var newMode = (hashParams.mode === 'proportional') ? 'proportional' : 'shaded';
                
                // Update mode if changed
                if (newMode !== mapMode) {
                    mapMode = newMode;
                    toggleMapMode();
                }
                
                // Restore selection
                restoreSelectionFromURL();
            });
            hashListenerBound = true;
        }
    })
    .catch(error => {
        console.error('Error loading data:', error);
        alert('Error loading map data: ' + error.message + '\n\nMake sure precincts_consolidated.geojson and results.json are in the same directory as this HTML file and that you are accessing the page through a web server (not file://).');
    });

