// Initialize map centered on Alameda County
var map = L.map('map').setView([37.8044, -122.2712], 10);

// Add CartoDB Positron (Light) tile layer
L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
}).addTo(map);

// Color scale for YES percentage
// 0-50% as red shades, 50-100% as green shades
function getColor(yesPct) {
    if (yesPct === null || yesPct === undefined || yesPct === 0) {
        return '#d3d3d3'; // Light grey for no data or 0%
    }
    // 1-50% as single red shade
    if (yesPct <= 50) {
        return '#fc9272'; // Light red shade for 1-50%
    }
    // Split 50-100% into 6 green steps
    return yesPct >= 100 ? '#006d2c' :  // Darkest green for 100%
           yesPct >= 95 ? '#238b45' :  // Very dark green for 95-100%
           yesPct >= 90 ? '#41ab5d' :  // Dark green for 90-95%
           yesPct >= 85 ? '#74c476' :  // Medium green for 85-90%
           yesPct >= 80 ? '#a1d99b' :  // Light green for 80-85%
           yesPct >= 75 ? '#c7e9c0' :  // Very light green for 75-80%
           '#d4e8d0';                   // Light green for 50-75%
}

// Style function
function style(feature) {
    var props = feature.properties;
    var yesPct = props.percentage && props.percentage.yes !== undefined ? 
                 props.percentage.yes : null;
    return {
        fillColor: getColor(yesPct),
        weight: 1,
        opacity: 1,
        color: yesPct === null ? '#999999' : 'white',
        dashArray: yesPct === null ? '5,5' : '3',
        fillOpacity: 0.7
    };
}

// Highlight on hover
function highlightFeature(e) {
    var layer = e.target;
    layer.setStyle({
        weight: 3,
        color: '#666',
        dashArray: '',
        fillOpacity: 0.9
    });
    if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
        layer.bringToFront();
    }
    updateInfoSection(layer.feature.properties);
}

// Reset highlight
function resetHighlight(e) {
    var layer = e.target;
    // Check if this layer is selected - if so, keep the black border
    var isSelected = selectedPrecincts.some(function(item) {
        return item.layer === layer;
    });
    
    if (isSelected) {
        // Keep selected style
        var yesPct = layer.feature.properties.percentage ? layer.feature.properties.percentage.yes : null;
        layer.setStyle({
            weight: 4,
            color: '#000000',
            fillOpacity: 0.8,
            dashArray: '',
            fillColor: getColor(yesPct)
        });
    } else {
        geojsonLayer.resetStyle(layer);
    }
    updateInfoSection(null);
}

// Zoom to feature on click
function zoomToFeature(e) {
    map.fitBounds(e.target.getBounds());
}

// Selected precincts for aggregation
var selectedPrecincts = [];
var isSelectionMode = false;
var currentCityName = null;

// Toggle precinct selection on command-click
function togglePrecinctSelection(e) {
    if (e.originalEvent.metaKey || e.originalEvent.ctrlKey) {
        e.originalEvent.preventDefault();
        isSelectionMode = true;
        var feature = e.target.feature;
        var layer = e.target;
        
        // Clear city name when manually selecting
        currentCityName = null;
        
        // Check if already selected
        var index = selectedPrecincts.findIndex(function(p) {
            return p.feature === feature;
        });
        
        if (index === -1) {
            // Add to selection
            selectedPrecincts.push({ feature: feature, layer: layer });
            var yesPct = feature.properties.percentage ? feature.properties.percentage.yes : null;
            layer.setStyle({
                weight: 4,
                color: '#000000',
                fillOpacity: 0.8,
                dashArray: '',
                fillColor: getColor(yesPct)
            });
            // Bring to front to ensure visibility
            if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                layer.bringToFront();
            }
        } else {
            // Remove from selection
            selectedPrecincts.splice(index, 1);
            geojsonLayer.resetStyle(layer);
        }
        
        // Update URL with selected precincts
        updateURL();
        
        // Update aggregated totals
        updateAggregatedTotals();
    } else {
        // Normal click - zoom
        zoomToFeature(e);
    }
}

// Calculate and display aggregated totals
function updateAggregatedTotals() {
    if (selectedPrecincts.length === 0) {
        updateInfoSection(null);
        return;
    }
    
    var aggregated = {
        yes: 0,
        no: 0,
        total: 0,
        count: selectedPrecincts.length
    };
    
    selectedPrecincts.forEach(function(item) {
        var props = item.feature.properties;
        if (props.votes) {
            if (props.votes.yes) aggregated.yes += props.votes.yes;
            if (props.votes.no) aggregated.no += props.votes.no;
            if (props.votes.total) aggregated.total += props.votes.total;
        }
    });
    
    // Calculate percentages
    if (aggregated.total > 0) {
        aggregated.yesPct = (aggregated.yes / aggregated.total) * 100;
        aggregated.noPct = (aggregated.no / aggregated.total) * 100;
    } else {
        aggregated.yesPct = 0;
        aggregated.noPct = 0;
    }
    
    // Create aggregated properties object
    var aggregatedProps = {
        aggregated: true,
        count: aggregated.count,
        cityName: currentCityName,
        votes: {
            yes: aggregated.yes,
            no: aggregated.no,
            total: aggregated.total
        },
        percentage: {
            yes: aggregated.yesPct,
            no: aggregated.noPct
        }
    };
    
    updateInfoSection(aggregatedProps);
}

// Update URL with selected precinct numbers
function updateURL() {
    // Get precinct IDs
    var precinctIds = selectedPrecincts.map(function(item) {
        var props = item.feature.properties;
        return props.Precinct_ID || 
               props['Precinct_ID'] || 
               props.precinct || 
               props['precinct'] ||
               props.ID || 
               props['ID'] || 
               'N/A';
    }).join('+');
    
    // Manually construct URL to preserve + signs
    var url = new URL(window.location);
    var baseUrl = url.protocol + '//' + url.host + url.pathname;
    var params = new URLSearchParams(url.search);
    
    if (precinctIds) {
        // Manually add precincts parameter with + signs
        params.delete('precincts');
        var queryString = params.toString();
        var separator = queryString ? '&' : '?';
        var newUrl = baseUrl + (queryString ? '?' + queryString + '&' : '?') + 'precincts=' + precinctIds;
        window.history.replaceState({}, '', newUrl);
    } else {
        // Remove precinct parameter if no selection
        params.delete('precincts');
        var queryString = params.toString();
        var newUrl = baseUrl + (queryString ? '?' + queryString : '');
        window.history.replaceState({}, '', newUrl);
    }
}

// City to precinct mapping
var cityPrecinctMap = {
    'alameda': ['305110', '304800', '305500', '305700', '303800', '302700', '301900', '302200', '300300', '300130', '300150', '300110']
};

// Restore selection from URL on page load
function restoreSelectionFromURL() {
    if (!geojsonLayer) {
        return;
    }
    
    var precinctIds = [];
    
    // Check for city parameter first
    var urlParams = new URLSearchParams(window.location.search);
    var cityParam = urlParams.get('city');
    
    if (cityParam && cityPrecinctMap[cityParam.toLowerCase()]) {
        // Use city mapping
        precinctIds = cityPrecinctMap[cityParam.toLowerCase()];
        currentCityName = cityParam.toLowerCase();
    } else {
        currentCityName = null;
        // Read raw query string to preserve + signs
        var search = window.location.search;
        var match = search.match(/[?&]precincts=([^&]*)/);
        
        if (!match) {
            return;
        }
        
        // Handle both + and , for backwards compatibility
        precinctIds = match[1].split(/[+,]/);
    }
    
    if (precinctIds.length === 0) {
        return;
    }
    
    // Wait for geojsonLayer to be populated
    setTimeout(function() {
        var foundCount = 0;
        geojsonLayer.eachLayer(function(layer) {
            var props = layer.feature.properties;
            var precinctId = props.Precinct_ID || 
                            props['Precinct_ID'] || 
                            props.precinct || 
                            props['precinct'] ||
                            props.ID || 
                            props['ID'] || 
                            null;
            
            // Convert to string for comparison
            var precinctIdStr = precinctId ? precinctId.toString() : null;
            
            if (precinctIdStr && precinctIds.indexOf(precinctIdStr) !== -1) {
                foundCount++;
                selectedPrecincts.push({ feature: layer.feature, layer: layer });
                // Set style with black border
                var yesPct = layer.feature.properties.percentage ? layer.feature.properties.percentage.yes : null;
                layer.setStyle({
                    weight: 4,
                    color: '#000000',
                    fillOpacity: 0.8,
                    dashArray: '',
                    fillColor: getColor(yesPct)
                });
                // Bring to front to ensure visibility
                if (!L.Browser.ie && !L.Browser.opera && !L.Browser.edge) {
                    layer.bringToFront();
                }
                isSelectionMode = true;
            }
        });
        
        console.log('Restored ' + foundCount + ' precincts from URL. Looking for:', precinctIds);
        
        if (selectedPrecincts.length > 0) {
            updateAggregatedTotals();
            
            // Calculate bounds of selected precincts and center/zoom map
            var bounds = L.latLngBounds([]);
            selectedPrecincts.forEach(function(item) {
                if (item.layer && item.layer.getBounds) {
                    try {
                        var layerBounds = item.layer.getBounds();
                        if (layerBounds.isValid()) {
                            bounds.extend(layerBounds);
                        }
                    } catch (e) {
                        // Skip if bounds can't be calculated
                    }
                }
            });
            
            if (bounds.isValid() && bounds.getNorth() !== bounds.getSouth() && bounds.getEast() !== bounds.getWest()) {
                // Add padding to bounds (10% on each side)
                var padding = 0.1;
                var north = bounds.getNorth();
                var south = bounds.getSouth();
                var east = bounds.getEast();
                var west = bounds.getWest();
                var latDiff = north - south;
                var lngDiff = east - west;
                
                // Shift center north to account for bottom panel (add more padding to south)
                var southPadding = latDiff * padding * 3; // More padding on south
                var northPadding = latDiff * padding * 0.3; // Less padding on north
                
                var paddedBounds = L.latLngBounds([
                    [south - southPadding, west - (lngDiff * padding)],
                    [north + northPadding, east + (lngDiff * padding)]
                ]);
                
                // Add more padding to bottom to account for bottom panel
                map.fitBounds(paddedBounds, { padding: [50, 50, 250, 50] }); // top, right, bottom, left
            }
        }
    }, 1000);
}

// Clear selection on Escape
document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isSelectionMode) {
        // Reset all selected precincts
        selectedPrecincts.forEach(function(item) {
            geojsonLayer.resetStyle(item.layer);
        });
        selectedPrecincts = [];
        isSelectionMode = false;
        currentCityName = null;
        updateURL();
        updateInfoSection(null);
    }
});

// Add event listeners
function onEachFeature(feature, layer) {
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        click: togglePrecinctSelection
    });
}

// Add GeoJSON layer
var geojsonLayer = L.geoJSON(null, {
    style: style,
    onEachFeature: onEachFeature
}).addTo(map);

// County totals (will be calculated from data)
var countyTotals = {
    yes: 0,
    no: 0,
    total: 0
};

// Load GeoJSON data
fetch('precincts_consolidated.geojson')
    .then(response => {
        if (!response.ok) {
            throw new Error('Network response was not ok');
        }
        return response.json();
    })
    .then(data => {
        console.log('Loaded GeoJSON with', data.features.length, 'features');
        
        // Calculate county totals
        data.features.forEach(function(feature) {
            if (feature.properties && feature.properties.votes) {
                var votes = feature.properties.votes;
                if (votes.yes) countyTotals.yes += votes.yes;
                if (votes.no) countyTotals.no += votes.no;
                if (votes.total) countyTotals.total += votes.total;
            }
        });
        
        // Calculate percentages
        if (countyTotals.total > 0) {
            countyTotals.yesPct = (countyTotals.yes / countyTotals.total) * 100;
            countyTotals.noPct = (countyTotals.no / countyTotals.total) * 100;
        } else {
            countyTotals.yesPct = 0;
            countyTotals.noPct = 0;
        }
        
        geojsonLayer.addData(data);
        if (geojsonLayer.getBounds().isValid()) {
            map.fitBounds(geojsonLayer.getBounds());
        } else {
            console.error('Invalid bounds');
        }
        
        // Update info section with county totals
        updateInfoSection(null);
        
        // Restore selection from URL if present
        restoreSelectionFromURL();
    })
    .catch(error => {
        console.error('Error loading GeoJSON:', error);
        alert('Error loading map data. Make sure precincts_consolidated.geojson is in the same directory as this HTML file.');
    });

// Update info section in bottom panel
function updateInfoSection(props) {
    var infoSection = document.getElementById('info-section');
    var bottomPanelContent = infoSection.parentElement;
    
    // Get current height
    var currentHeight = bottomPanelContent.offsetHeight;
    bottomPanelContent.style.height = currentHeight + 'px';
    
    // Fade out
    infoSection.style.opacity = '0';
    
    setTimeout(function() {
        if (!props) {
            // Show county totals
            var content = '<div class="precinct-name">Alameda County</div>';
            content += '<div class="data-columns">';
            
            // YES column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">YES</div>';
            content += '<div class="data-column-votes">' + countyTotals.yes.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">' + countyTotals.yesPct.toFixed(1) + '%</div>';
            content += '</div>';
            // Total column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">Total</div>';
            content += '<div class="data-column-votes">' + countyTotals.total.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">—</div>';
            content += '</div>';
            // NO column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">NO</div>';
            content += '<div class="data-column-votes">' + countyTotals.no.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">' + countyTotals.noPct.toFixed(1) + '%</div>';
            content += '</div>';
            content += '</div>';
            
            // Add bar graph
            content += '<div class="bar-graph">';
            content += '<div class="bar-graph-yes" style="width: ' + countyTotals.yesPct + '%;"></div>';
            content += '<div class="bar-graph-no" style="width: ' + countyTotals.noPct + '%;"></div>';
            content += '</div>';
            
            infoSection.innerHTML = content;
            
            // Get new height and transition
            setTimeout(function() {
                var newHeight = bottomPanelContent.scrollHeight;
                bottomPanelContent.style.height = newHeight + 'px';
                
                // Fade in
                infoSection.style.opacity = '1';
                
                // Remove height constraint after transition
                setTimeout(function() {
                    bottomPanelContent.style.height = 'auto';
                }, 400);
            }, 10);
            return;
        }
    
        // Check if this is aggregated data
        if (props.aggregated) {
            var title = props.cityName ? 'City of ' + props.cityName.charAt(0).toUpperCase() + props.cityName.slice(1) : props.count + ' Precincts Selected';
            var content = '<div class="precinct-name">' + title + '</div>';
            var hasVotes = props.votes && props.votes.total !== undefined;
        } else {
            // Try multiple ways to get the precinct name
            var precinctName = props.Precinct_ID || 
                              props['Precinct_ID'] || 
                              props.precinct || 
                              props['precinct'] ||
                              props.ID || 
                              props['ID'] || 
                              'N/A';
            
            var hasVotes = props.votes && props.votes.total !== undefined;
            
            var content = '<div class="precinct-name">Precinct ' + precinctName + '</div>';
        }
        
        content += '<div class="data-columns">';
        
        if (hasVotes && props.votes.total > 0) {
            var yesPct = props.percentage ? props.percentage.yes : 0;
            var yesVotes = props.votes.yes || 0;
            var noPct = props.percentage ? props.percentage.no : 0;
            var noVotes = props.votes.no || 0;
            var totalVotes = props.votes.total || 0;
            
            // YES column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">YES</div>';
            content += '<div class="data-column-votes">' + yesVotes.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">' + yesPct.toFixed(1) + '%</div>';
            content += '</div>';
            // Total column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">Total</div>';
            content += '<div class="data-column-votes">' + totalVotes.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">—</div>';
            content += '</div>';
            // NO column
            content += '<div class="data-column">';
            content += '<div class="data-column-header">NO</div>';
            content += '<div class="data-column-votes">' + noVotes.toLocaleString() + ' votes</div>';
            content += '<div class="data-column-percent">' + noPct.toFixed(1) + '%</div>';
            content += '</div>';
        } else {
            // YES column - empty
            content += '<div class="data-column">';
            content += '<div class="data-column-header">YES</div>';
            content += '<div class="data-column-votes">&nbsp;</div>';
            content += '<div class="data-column-percent">&nbsp;</div>';
            content += '</div>';
            // Total column - empty
            content += '<div class="data-column">';
            content += '<div class="data-column-header">Total</div>';
            content += '<div class="data-column-votes">&nbsp;</div>';
            content += '<div class="data-column-percent">—</div>';
            content += '</div>';
            // NO column - empty
            content += '<div class="data-column">';
            content += '<div class="data-column-header">NO</div>';
            content += '<div class="data-column-votes">&nbsp;</div>';
            content += '<div class="data-column-percent">&nbsp;</div>';
            content += '</div>';
        }
        
        content += '</div>';
        
        // Add bar graph - always show structure to maintain bounding box
        var yesPct = (hasVotes && props.votes.total > 0 && props.percentage) ? props.percentage.yes : 0;
        var noPct = (hasVotes && props.votes.total > 0 && props.percentage) ? props.percentage.no : 0;
        content += '<div class="bar-graph">';
        content += '<div class="bar-graph-yes" style="width: ' + yesPct + '%;"></div>';
        content += '<div class="bar-graph-no" style="width: ' + noPct + '%;"></div>';
        // Add county average line for all data (precinct and aggregated)
        if (hasVotes && props.votes.total > 0 && countyTotals.yesPct !== undefined) {
            content += '<div class="bar-graph-county-marker" style="left: ' + countyTotals.yesPct + '%;">';
            content += '<div class="bar-graph-county-line"></div>';
            content += '<div class="bar-graph-county-label">County</div>';
            content += '</div>';
        }
        content += '</div>';
        
        infoSection.innerHTML = content;
        
        // Get new height and transition
        setTimeout(function() {
            var newHeight = bottomPanelContent.scrollHeight;
            bottomPanelContent.style.height = newHeight + 'px';
            
            // Fade in
            infoSection.style.opacity = '1';
            
            // Remove height constraint after transition
            setTimeout(function() {
                bottomPanelContent.style.height = 'auto';
            }, 400);
        }, 10);
    }, 150);
}

// Create horizontal legend
function createHorizontalLegend() {
    var legendContainer = document.getElementById('legend-horizontal');
    
    // Single red key for 0-50% (with detailed shading but simplified legend)
    var itemRed = document.createElement('div');
    itemRed.className = 'legend-item';
    itemRed.innerHTML = '<div class="legend-color" style="background:' + getColor(25) + '"></div><span>0&ndash;50%</span>';
    legendContainer.appendChild(itemRed);
    
    // Green shades for 50-100%
    // 50-75%
    var item50 = document.createElement('div');
    item50.className = 'legend-item';
    item50.innerHTML = '<div class="legend-color" style="background:' + getColor(62.5) + '"></div><span>50&ndash;75%</span>';
    legendContainer.appendChild(item50);
    
    // 75-80%
    var item75 = document.createElement('div');
    item75.className = 'legend-item';
    item75.innerHTML = '<div class="legend-color" style="background:' + getColor(77.5) + '"></div><span>75&ndash;80%</span>';
    legendContainer.appendChild(item75);
    
    // 80-85%
    var item80 = document.createElement('div');
    item80.className = 'legend-item';
    item80.innerHTML = '<div class="legend-color" style="background:' + getColor(82.5) + '"></div><span>80&ndash;85%</span>';
    legendContainer.appendChild(item80);
    
    // 85-90%
    var item85 = document.createElement('div');
    item85.className = 'legend-item';
    item85.innerHTML = '<div class="legend-color" style="background:' + getColor(87.5) + '"></div><span>85&ndash;90%</span>';
    legendContainer.appendChild(item85);
    
    // 90-95%
    var item90 = document.createElement('div');
    item90.className = 'legend-item';
    item90.innerHTML = '<div class="legend-color" style="background:' + getColor(92.5) + '"></div><span>90&ndash;95%</span>';
    legendContainer.appendChild(item90);
    
    // 95-100%
    var item95 = document.createElement('div');
    item95.className = 'legend-item';
    item95.innerHTML = '<div class="legend-color" style="background:' + getColor(97.5) + '"></div><span>95&ndash;100%</span>';
    legendContainer.appendChild(item95);
    
    // No data
    var noDataItem = document.createElement('div');
    noDataItem.className = 'legend-item';
    noDataItem.innerHTML = '<div class="legend-color" style="background:#d3d3d3"></div><span>No data</span>';
    legendContainer.appendChild(noDataItem);
}

createHorizontalLegend();

