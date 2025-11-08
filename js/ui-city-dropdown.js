// ============================================================================
// UI CITY DROPDOWN
// ============================================================================

// Build city dropdown
function buildCityDropdown() {
    var dropdownContent = document.getElementById('city-dropdown-content');
    if (!dropdownContent) return;
    
    // Sort cities by name, but exclude "Alameda County" since we add it manually
    var cities = Object.keys(cityStats).map(function(key) {
        return {
            key: key,
            name: cityStats[key].name,
            yesPct: cityStats[key].yesPct || 0
        };
    }).filter(function(city) {
        // Filter out "Alameda County" - we add it manually at the top
        // Keep "Unincorporated Alameda County" as a distinct option
        var cityNameLower = city.name.toLowerCase();
        return cityNameLower !== 'alameda county';
    }).sort(function(a, b) {
        // Sort alphabetically, but put "Unincorporated Alameda County" at the end
        var aIsUnincorporated = a.name.toLowerCase() === 'unincorporated alameda county';
        var bIsUnincorporated = b.name.toLowerCase() === 'unincorporated alameda county';
        
        if (aIsUnincorporated && !bIsUnincorporated) return 1;
        if (!aIsUnincorporated && bIsUnincorporated) return -1;
        return a.name.localeCompare(b.name);
    });
    
    // Clear existing content
    dropdownContent.innerHTML = '';
    
    // Add "Alameda County" option at the top
    var countyItem = document.createElement('div');
    countyItem.className = 'city-dropdown-item';
    countyItem.setAttribute('data-city-key', '');
    var countyName = document.createElement('span');
    countyName.className = 'city-dropdown-item-name';
    countyName.textContent = 'Alameda County';
    var countyStats = document.createElement('span');
    countyStats.className = 'city-dropdown-item-stats';
    if (countyTotals.total > 0) {
        countyStats.textContent = 'Yes – ' + countyTotals.yesPct.toFixed(1) + '%';
    }
    countyItem.appendChild(countyName);
    countyItem.appendChild(countyStats);
    countyItem.addEventListener('click', function(e) {
        e.stopPropagation();
        selectCity(null);
    });
    dropdownContent.appendChild(countyItem);
    
    // Add each city
    cities.forEach(function(city) {
        var cityItem = document.createElement('div');
        cityItem.className = 'city-dropdown-item';
        cityItem.setAttribute('data-city-key', city.key);
        var cityName = document.createElement('span');
        cityName.className = 'city-dropdown-item-name';
        cityName.textContent = city.name;
        var cityStatsEl = document.createElement('span');
        cityStatsEl.className = 'city-dropdown-item-stats';
        if (city.yesPct > 0) {
            cityStatsEl.textContent = 'Yes – ' + city.yesPct.toFixed(1) + '%';
        }
        cityItem.appendChild(cityName);
        cityItem.appendChild(cityStatsEl);
        cityItem.addEventListener('click', function(e) {
            e.stopPropagation();
            selectCity(city.key);
        });
        dropdownContent.appendChild(cityItem);
    });
}

// Toggle city dropdown
function toggleCityDropdown() {
    var dropdown = document.getElementById('city-dropdown');
    if (!dropdown) return;
    
    cityDropdownOpen = !cityDropdownOpen;
    dropdown.style.display = cityDropdownOpen ? 'block' : 'none';
    
    // Close dropdown when clicking outside
    if (cityDropdownOpen) {
        // Remove existing handler if any
        if (cityDropdownCloseHandler) {
            document.removeEventListener('click', cityDropdownCloseHandler, true);
            cityDropdownCloseHandler = null;
        }
        
        setTimeout(function() {
            cityDropdownCloseHandler = function(e) {
                var btn = document.getElementById('city-selector-btn');
                var dropdownEl = document.getElementById('city-dropdown');
                if (btn && dropdownEl && !btn.contains(e.target) && !dropdownEl.contains(e.target)) {
                    cityDropdownOpen = false;
                    dropdown.style.display = 'none';
                    document.removeEventListener('click', cityDropdownCloseHandler, true);
                    cityDropdownCloseHandler = null;
                }
            };
            // Use capture phase to catch clicks before they bubble
            document.addEventListener('click', cityDropdownCloseHandler, true);
        }, 100);
    } else {
        // Remove handler when closing dropdown
        if (cityDropdownCloseHandler) {
            document.removeEventListener('click', cityDropdownCloseHandler, true);
            cityDropdownCloseHandler = null;
        }
    }
}

// Make toggleCityDropdown globally accessible
window.toggleCityDropdown = toggleCityDropdown;

// Select a city
function selectCity(cityKey) {
    cityDropdownOpen = false;
    var dropdown = document.getElementById('city-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    
    // Clean up close handler
    if (cityDropdownCloseHandler) {
        document.removeEventListener('click', cityDropdownCloseHandler, true);
        cityDropdownCloseHandler = null;
    }
    
    if (!cityKey) {
        // Clear city selection - show all precincts
        selectedPrecincts.forEach(function(item) {
            if (item.layer && item.feature) {
                var props = item.feature.properties;
                var yesPct = getYesPercentage(props);
                resetLayerStyle(item.layer, yesPct);
            }
        });
        selectedPrecincts = [];
        currentCityName = null;
        updateCityButtonText();
        updateURL();
        updateInfoSection(null);
        
        // Fit to all districts
        if (baseDistrictBounds && baseDistrictBounds.isValid()) {
            var isMobile = window.innerWidth <= 768;
            var bottomPanel = document.getElementById('bottom-panel');
            var bottomPadding = bottomPanel ? bottomPanel.offsetHeight + (isMobile ? 140 : 80) : (isMobile ? 360 : 240);
            map.fitBounds(baseDistrictBounds, {
                paddingTopLeft: L.point(20, 20),
                paddingBottomRight: L.point(20, bottomPadding)
            });
            applyMobileVerticalBias();
        }
        return;
    }
    
    // Navigate to city
    var hashParams = parseHashParams();
    hashParams.city = cityKey;
    delete hashParams.precincts; // Clear precincts when selecting city
    var newHash = buildHashParams(hashParams);
    window.location.hash = newHash;
    
    // restoreSelectionFromURL will handle the rest
    restoreSelectionFromURL();
}

// Make selectCity globally accessible
window.selectCity = selectCity;

// Update city button text
function updateCityButtonText() {
    var btn = document.getElementById('city-selector-btn');
    if (!btn) return;
    
    if (currentCityName) {
        // Don't say "City" for unincorporated areas
        var isUnincorporated = currentCityName.toLowerCase() === 'unincorporated alameda county';
        if (isUnincorporated) {
            btn.textContent = currentCityName;
        } else {
            btn.textContent = 'City – ' + currentCityName;
        }
    } else {
        btn.textContent = 'City – Alameda County';
    }
}

