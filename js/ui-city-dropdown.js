// ============================================================================
// UI CITY DROPDOWN
// ============================================================================
import { state } from './state.js';
import { getYesPercentage } from './data-helpers.js';
import { resetLayerStyle } from './map-styling.js';
import { updateURL } from './url-manager.js';
import { updateInfoSection } from './ui-info-section.js';
import { applyMobileVerticalBias } from './map-utils.js';
import { parseHashParams, buildHashParams } from './url-manager.js';
import { restoreSelectionFromURL } from './state-restore.js';
// Build city dropdown
export function buildCityDropdown() {
    const dropdownContent = document.getElementById('city-dropdown-content');
    if (!dropdownContent)
        return;
    // Sort cities by name, but exclude "Alameda County" since we add it manually
    const cities = Object.keys(state.cityStats).map((key) => {
        return {
            key: key,
            name: state.cityStats[key].name,
            yesPct: state.cityStats[key].yesPct || 0
        };
    }).filter((city) => {
        // Filter out "Alameda County" - we add it manually at the top
        // Keep "Unincorporated Alameda County" as a distinct option
        const cityNameLower = city.name.toLowerCase();
        return cityNameLower !== 'alameda county';
    }).sort((a, b) => {
        // Sort alphabetically, but put "Unincorporated Alameda County" at the end
        const aIsUnincorporated = a.name.toLowerCase() === 'unincorporated alameda county';
        const bIsUnincorporated = b.name.toLowerCase() === 'unincorporated alameda county';
        if (aIsUnincorporated && !bIsUnincorporated)
            return 1;
        if (!aIsUnincorporated && bIsUnincorporated)
            return -1;
        return a.name.localeCompare(b.name);
    });
    // Clear existing content
    dropdownContent.innerHTML = '';
    // Add "Alameda County" option at the top
    const countyItem = document.createElement('div');
    countyItem.className = 'city-dropdown-item';
    countyItem.setAttribute('data-city-key', '');
    const countyName = document.createElement('span');
    countyName.className = 'city-dropdown-item-name';
    countyName.textContent = 'Alameda County';
    const countyStatsEl = document.createElement('span');
    countyStatsEl.className = 'city-dropdown-item-stats';
    if (state.countyTotals.total > 0) {
        countyStatsEl.textContent = 'Yes – ' + state.countyTotals.yesPct.toFixed(1) + '%';
    }
    countyItem.appendChild(countyName);
    countyItem.appendChild(countyStatsEl);
    countyItem.addEventListener('click', (e) => {
        e.stopPropagation();
        selectCity(null);
    });
    dropdownContent.appendChild(countyItem);
    // Add each city
    cities.forEach((city) => {
        const cityItem = document.createElement('div');
        cityItem.className = 'city-dropdown-item';
        cityItem.setAttribute('data-city-key', city.key);
        const cityName = document.createElement('span');
        cityName.className = 'city-dropdown-item-name';
        cityName.textContent = city.name;
        const cityStatsEl = document.createElement('span');
        cityStatsEl.className = 'city-dropdown-item-stats';
        if (city.yesPct > 0) {
            cityStatsEl.textContent = 'Yes – ' + city.yesPct.toFixed(1) + '%';
        }
        cityItem.appendChild(cityName);
        cityItem.appendChild(cityStatsEl);
        cityItem.addEventListener('click', (e) => {
            e.stopPropagation();
            selectCity(city.key);
        });
        dropdownContent.appendChild(cityItem);
    });
}
// Toggle city dropdown
export function toggleCityDropdown() {
    const dropdown = document.getElementById('city-dropdown');
    if (!dropdown)
        return;
    state.cityDropdownOpen = !state.cityDropdownOpen;
    dropdown.style.display = state.cityDropdownOpen ? 'block' : 'none';
    // Close dropdown when clicking outside
    if (state.cityDropdownOpen) {
        // Remove existing handler if any
        if (state.cityDropdownCloseHandler) {
            document.removeEventListener('click', state.cityDropdownCloseHandler, true);
            state.cityDropdownCloseHandler = null;
        }
        setTimeout(() => {
            state.cityDropdownCloseHandler = (e) => {
                const btn = document.getElementById('city-selector-btn');
                const dropdownEl = document.getElementById('city-dropdown');
                if (btn && dropdownEl && !btn.contains(e.target) && !dropdownEl.contains(e.target)) {
                    state.cityDropdownOpen = false;
                    dropdown.style.display = 'none';
                    if (state.cityDropdownCloseHandler) {
                        document.removeEventListener('click', state.cityDropdownCloseHandler, true);
                        state.cityDropdownCloseHandler = null;
                    }
                }
            };
            // Use capture phase to catch clicks before they bubble
            document.addEventListener('click', state.cityDropdownCloseHandler, true);
        }, 100);
    }
    else {
        // Remove handler when closing dropdown
        if (state.cityDropdownCloseHandler) {
            document.removeEventListener('click', state.cityDropdownCloseHandler, true);
            state.cityDropdownCloseHandler = null;
        }
    }
}
// Make toggleCityDropdown globally accessible
window.toggleCityDropdown = toggleCityDropdown;
// Select a city
export function selectCity(cityKey) {
    state.cityDropdownOpen = false;
    const dropdown = document.getElementById('city-dropdown');
    if (dropdown) {
        dropdown.style.display = 'none';
    }
    // Clean up close handler
    if (state.cityDropdownCloseHandler) {
        document.removeEventListener('click', state.cityDropdownCloseHandler, true);
        state.cityDropdownCloseHandler = null;
    }
    if (!cityKey) {
        // Clear city selection - show all precincts
        state.selectedPrecincts.forEach((item) => {
            if (item.layer && item.feature) {
                const props = item.feature.properties;
                const yesPct = getYesPercentage(props);
                resetLayerStyle(item.layer, yesPct);
            }
        });
        state.selectedPrecincts.length = 0;
        state.currentCityName = null;
        updateCityButtonText();
        updateURL();
        updateInfoSection(null);
        // Fit to all districts
        if (state.baseDistrictBounds && state.baseDistrictBounds.isValid() && state.map) {
            const isMobile = window.innerWidth <= 768;
            const bottomPanel = document.getElementById('bottom-panel');
            const bottomPadding = bottomPanel ? bottomPanel.offsetHeight + (isMobile ? 140 : 80) : (isMobile ? 360 : 240);
            state.map.fitBounds(state.baseDistrictBounds, {
                paddingTopLeft: L.point(20, 20),
                paddingBottomRight: L.point(20, bottomPadding)
            });
            applyMobileVerticalBias();
        }
        return;
    }
    // Navigate to city
    const hashParams = parseHashParams();
    hashParams.city = cityKey;
    hashParams.precincts = null; // Clear precincts when selecting city
    const newHash = buildHashParams(hashParams);
    window.location.hash = newHash;
    // restoreSelectionFromURL will handle the rest
    restoreSelectionFromURL();
}
// Make selectCity globally accessible
window.selectCity = selectCity;
// Update city button text
export function updateCityButtonText() {
    const btn = document.getElementById('city-selector-btn');
    if (!btn)
        return;
    if (state.currentCityName) {
        // Don't say "City" for unincorporated areas
        const isUnincorporated = state.currentCityName.toLowerCase() === 'unincorporated alameda county';
        if (isUnincorporated) {
            btn.textContent = state.currentCityName;
        }
        else {
            btn.textContent = 'City – ' + state.currentCityName;
        }
    }
    else {
        btn.textContent = 'City – Alameda County';
    }
}
