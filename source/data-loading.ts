// ============================================================================
// DATA LOADING
// ============================================================================

import { state } from './state.js';
import { getL } from './leaflet-helper.js';
import { mapMode, createProportionalSymbols } from './map-mode.js';
import { style } from './map-styling.js';
import { onEachFeature } from './map-events.js';
import { getPrecinctId } from './data-helpers.js';
import { calculateCityStats } from './city-stats.js';
import { buildCityDropdown } from './ui-city-dropdown.js';
import { updateInfoSection } from './ui-info-section.js';
import { updateCityButtonText } from './ui-city-dropdown.js';
import { buildContestDropdown } from './ui-contest-selector.js';
import { updateElectionButtonText, updatePageHeader } from './ui-election-selector.js';
import { parseHashParams, buildHashParams } from './url-manager.js';
import type { ContestInfo } from './types.js';
import { normalizeCityName, getDisplayCityName } from './city-helpers.js';
import { safeGet } from './data-helpers.js';
// Bias adjustments removed - they were causing map bumping on initial load
import { restoreSelectionFromURL } from './state-restore.js';
import { toggleMapMode } from './map-mode.js';
import type { GeoJSONData, ResultData } from './types.js';
import type { LatLngBounds } from 'leaflet';

// Initialize GeoJSON layer when Leaflet is available
function initGeoJSONLayer() {
  try {
    const leaflet = getL();
    state.geojsonLayer = leaflet.geoJSON(null, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet style function signature
      style: style as any,
      onEachFeature: onEachFeature,
    });

    // Only add to map if in shaded mode (default is shaded)
    if (mapMode === 'shaded' && state.map && state.geojsonLayer) {
      state.geojsonLayer.addTo(state.map);
    }

    // Load data once layer is initialized
    loadData();
  } catch (_e) {
    // Retry if Leaflet not loaded yet
    setTimeout(initGeoJSONLayer, 10);
  }
}

// Load GeoJSON data and results.json
function loadData() {
  const leaflet = getL();
  const hashParams = parseHashParams();

  // Determine which results file and precinct file to load
  let resultsFilename = 'data/results/results.json'; // Default for backward compatibility
  let precinctFilename = 'precincts_consolidated.geojson'; // Default for backward compatibility
  if (hashParams.election) {
    resultsFilename = `data/results/results-${hashParams.election}.json`;
    precinctFilename = `precincts-${hashParams.election}.geojson`;
    state.selectedElection = hashParams.election;
  } else {
    // Try to find the most recent results file
    // For now, default to results.json, but could be enhanced to scan available files
    state.selectedElection = null;
  }

  Promise.all([
    fetch(precinctFilename).then((response) => {
      if (!response.ok) {
        // Fallback to default if election-specific file doesn't exist
        if (precinctFilename !== 'precincts_consolidated.geojson') {
          console.warn(
            `Could not load ${precinctFilename}, falling back to precincts_consolidated.geojson`
          );
          return fetch('precincts_consolidated.geojson').then((r) => {
            if (!r.ok) {
              throw new Error('Network response was not ok: ' + r.status + ' ' + r.statusText);
            }
            return r.json();
          });
        }
        throw new Error(
          'Network response was not ok: ' + response.status + ' ' + response.statusText
        );
      }
      return response.json();
    }),
    fetch(resultsFilename).then((response) => {
      if (!response.ok) {
        // Fallback to default if election-specific file doesn't exist
        if (resultsFilename !== 'data/results/results.json') {
          console.warn(
            `Could not load ${resultsFilename}, falling back to data/results/results.json`
          );
          return fetch('data/results/results.json').then((r) => {
            if (!r.ok) {
              throw new Error(`Could not load results file: ` + r.status + ' ' + r.statusText);
            }
            return r.json();
          });
        }
        throw new Error(
          `Could not load ${resultsFilename}: ` + response.status + ' ' + response.statusText
        );
      }
      return response.json();
    }),
  ])
    .then((results: [GeoJSONData, ResultData[]]) => {
      const data = results[0];
      const resultsData = results[1];
      const hashParams = parseHashParams(); // Parse hash params early for use throughout

      if (!resultsData || !Array.isArray(resultsData)) {
        throw new Error(`${resultsFilename} is invalid or empty`);
      }

      // Detect format: new format has contests, old format has votes/percentage
      const isNewFormat = resultsData.some((r) => r.contests && Object.keys(r.contests).length > 0);

      if (isNewFormat) {
        // New multi-contest format
        // Build contest metadata
        const contestMap = new Map<number, ContestInfo>();
        resultsData.forEach((result: ResultData) => {
          if (result.contests) {
            for (const [contestIdStr, contestData] of Object.entries(result.contests)) {
              const contestId = parseInt(contestIdStr, 10);
              if (!contestMap.has(contestId)) {
                contestMap.set(contestId, {
                  contestId,
                  contestName: contestData.contestName,
                  voteFor: 1, // Default, could be enhanced
                  numOfRanks: 0, // Default, could be enhanced
                });
              }
            }
          }
        });
        state.contests = Object.fromEntries(contestMap);

        // Determine selected contest
        if (hashParams.contest !== null && hashParams.contest !== undefined) {
          state.selectedContestId = hashParams.contest;
        } else if (Object.keys(state.contests).length > 0) {
          // Default to first contest
          const firstContestId = parseInt(Object.keys(state.contests)[0], 10);
          state.selectedContestId = firstContestId;
        }

        // Create a map of all vote data from results.json
        const resultsMap: { [key: string]: ResultData } = {};
        resultsData.forEach((result: ResultData) => {
          if (result.precinct) {
            resultsMap[result.precinct.toString()] = result;
          }
        });

        // Merge contest data into GeoJSON features
        data.features.forEach((feature) => {
          const precinctId = getPrecinctId(feature.properties);
          if (precinctId && resultsMap[precinctId.toString()]) {
            const resultData = resultsMap[precinctId.toString()];
            if (resultData.contests) {
              feature.properties.contests = resultData.contests;
            }
            // Also set legacy format for backward compatibility if contest is yes/no
            if (state.selectedContestId && resultData.contests?.[state.selectedContestId]) {
              const contest = resultData.contests[state.selectedContestId];
              // Check if it's a yes/no contest (2 candidates)
              if (contest.candidates.length === 2) {
                const yesCandidate = contest.candidates.find((c) =>
                  c.candidateName.toUpperCase().includes('YES')
                );
                const noCandidate = contest.candidates.find((c) =>
                  c.candidateName.toUpperCase().includes('NO')
                );
                if (yesCandidate && noCandidate) {
                  feature.properties.votes = {
                    yes: yesCandidate.votes,
                    no: noCandidate.votes,
                    total: contest.totalVotes,
                  };
                  feature.properties.percentage = {
                    yes: yesCandidate.percentage,
                    no: noCandidate.percentage,
                  };
                }
              }
            }
          }
        });
      } else {
        // Legacy format - backward compatibility
        state.selectedContestId = null;
        const resultsMap: { [key: string]: ResultData } = {};
        resultsData.forEach((result: ResultData) => {
          if (result.precinct) {
            resultsMap[result.precinct.toString()] = {
              votes: result.votes,
              percentage: result.percentage,
              vote_method: result.vote_method,
            };
          }
        });

        // Merge all vote data from results.json into GeoJSON features
        data.features.forEach((feature) => {
          const precinctId = getPrecinctId(feature.properties);
          if (precinctId && resultsMap[precinctId.toString()]) {
            const voteData = resultsMap[precinctId.toString()];
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
      }

      // Calculate city statistics
      state.cityStats = calculateCityStats(data);

      // Reset county totals before calculation to prevent accumulation
      state.countyTotals.yes = 0;
      state.countyTotals.no = 0;
      state.countyTotals.total = 0;
      state.countyTotals.mailInTotal = 0;
      state.countyTotals.mailInYes = 0;
      state.countyTotals.mailInNo = 0;
      state.countyTotals.inPersonTotal = 0;
      state.countyTotals.inPersonYes = 0;
      state.countyTotals.inPersonNo = 0;

      // Calculate county totals from results.json with error handling
      try {
        if (isNewFormat && state.selectedContestId) {
          // New format: calculate totals for selected contest
          resultsData.forEach((result: ResultData) => {
            if (!result || !result.contests) return;
            const contest = result.contests[state.selectedContestId!];
            if (!contest) return;

            // Find yes/no candidates if it's a yes/no contest
            const yesCandidate = contest.candidates.find((c) =>
              c.candidateName.toUpperCase().includes('YES')
            );
            const noCandidate = contest.candidates.find((c) =>
              c.candidateName.toUpperCase().includes('NO')
            );

            if (yesCandidate && noCandidate) {
              state.countyTotals.yes += yesCandidate.votes;
              state.countyTotals.no += noCandidate.votes;
              state.countyTotals.total += contest.totalVotes;

              // Vote method totals
              if (contest.vote_method) {
                if (contest.vote_method.mail_in) {
                  const mailInYes = contest.vote_method.mail_in.candidates.find((c) =>
                    c.candidateName.toUpperCase().includes('YES')
                  );
                  const mailInNo = contest.vote_method.mail_in.candidates.find((c) =>
                    c.candidateName.toUpperCase().includes('NO')
                  );
                  if (mailInYes && mailInNo) {
                    state.countyTotals.mailInTotal += contest.vote_method.mail_in.totalVotes;
                    state.countyTotals.mailInYes += mailInYes.votes;
                    state.countyTotals.mailInNo += mailInNo.votes;
                  }
                }
                if (contest.vote_method.in_person) {
                  const inPersonYes = contest.vote_method.in_person.candidates.find((c) =>
                    c.candidateName.toUpperCase().includes('YES')
                  );
                  const inPersonNo = contest.vote_method.in_person.candidates.find((c) =>
                    c.candidateName.toUpperCase().includes('NO')
                  );
                  if (inPersonYes && inPersonNo) {
                    state.countyTotals.inPersonTotal += contest.vote_method.in_person.totalVotes;
                    state.countyTotals.inPersonYes += inPersonYes.votes;
                    state.countyTotals.inPersonNo += inPersonNo.votes;
                  }
                }
              }
            }
          });
        } else {
          // Legacy format
          resultsData.forEach((result: ResultData) => {
            if (!result) return;

            // Calculate overall vote totals
            if (result.votes && typeof result.votes === 'object') {
              const votes = result.votes;
              if (typeof votes.yes === 'number' && votes.yes > 0) {
                state.countyTotals.yes += votes.yes;
              }
              if (typeof votes.no === 'number' && votes.no > 0) {
                state.countyTotals.no += votes.no;
              }
              if (typeof votes.total === 'number' && votes.total > 0) {
                state.countyTotals.total += votes.total;
              }
            }

            // Calculate county-level vote method totals
            if (result.vote_method && typeof result.vote_method === 'object') {
              if (
                result.vote_method.mail_in &&
                result.vote_method.mail_in.votes &&
                typeof result.vote_method.mail_in.votes === 'object'
              ) {
                const mailInVotes = result.vote_method.mail_in.votes;
                if (typeof mailInVotes.total === 'number' && mailInVotes.total > 0) {
                  state.countyTotals.mailInTotal += mailInVotes.total;
                }
                if (typeof mailInVotes.yes === 'number' && mailInVotes.yes > 0) {
                  state.countyTotals.mailInYes += mailInVotes.yes;
                }
                if (typeof mailInVotes.no === 'number' && mailInVotes.no > 0) {
                  state.countyTotals.mailInNo += mailInVotes.no;
                }
              }
              if (
                result.vote_method.in_person &&
                result.vote_method.in_person.votes &&
                typeof result.vote_method.in_person.votes === 'object'
              ) {
                const inPersonVotes = result.vote_method.in_person.votes;
                if (typeof inPersonVotes.total === 'number' && inPersonVotes.total > 0) {
                  state.countyTotals.inPersonTotal += inPersonVotes.total;
                }
                if (typeof inPersonVotes.yes === 'number' && inPersonVotes.yes > 0) {
                  state.countyTotals.inPersonYes += inPersonVotes.yes;
                }
                if (typeof inPersonVotes.no === 'number' && inPersonVotes.no > 0) {
                  state.countyTotals.inPersonNo += inPersonVotes.no;
                }
              }
            }
          });
        }
      } catch (_error) {
        // Reset to safe defaults on error
        state.countyTotals.yes = 0;
        state.countyTotals.no = 0;
        state.countyTotals.total = 0;
        state.countyTotals.mailInTotal = 0;
        state.countyTotals.mailInYes = 0;
        state.countyTotals.mailInNo = 0;
        state.countyTotals.inPersonTotal = 0;
        state.countyTotals.inPersonYes = 0;
        state.countyTotals.inPersonNo = 0;
      }

      // Calculate percentages
      if (state.countyTotals.total > 0) {
        state.countyTotals.yesPct = (state.countyTotals.yes / state.countyTotals.total) * 100;
        state.countyTotals.noPct = (state.countyTotals.no / state.countyTotals.total) * 100;
      } else {
        state.countyTotals.yesPct = 0;
        state.countyTotals.noPct = 0;
      }

      // Calculate county-level mail-in percentage of total votes
      if (state.countyTotals.total > 0) {
        state.countyTotals.mailInPctOfTotal =
          (state.countyTotals.mailInTotal / state.countyTotals.total) * 100;
      } else {
        state.countyTotals.mailInPctOfTotal = 0;
      }

      // Calculate county-level mail-in YES percentage
      if (state.countyTotals.mailInTotal > 0) {
        state.countyTotals.mailInYesPct =
          (state.countyTotals.mailInYes / state.countyTotals.mailInTotal) * 100;
      } else {
        state.countyTotals.mailInYesPct = 0;
      }

      // Calculate county-level in-person YES percentage
      if (state.countyTotals.inPersonTotal > 0) {
        state.countyTotals.inPersonYesPct =
          (state.countyTotals.inPersonYes / state.countyTotals.inPersonTotal) * 100;
      } else {
        state.countyTotals.inPersonYesPct = 0;
      }

      // Build city dropdown (after county totals are calculated)
      // Only build once to avoid duplicates
      if (Object.keys(state.cityStats).length > 0) {
        buildCityDropdown();
      }

      // Update election button text and page header
      updateElectionButtonText();
      updatePageHeader();

      // Show and build contest selector if we have contests
      const contestButton = document.getElementById('contest-selector-btn');
      if (Object.keys(state.contests).length > 0) {
        if (contestButton) {
          contestButton.style.display = 'inline-block';
          if (state.selectedContestId && state.contests[state.selectedContestId]) {
            contestButton.textContent = `Contest – ${state.contests[state.selectedContestId].contestName}`;
          } else {
            contestButton.textContent = 'Contest – Select';
          }
          buildContestDropdown();
        }
      } else {
        if (contestButton) {
          contestButton.style.display = 'none';
        }
      }

      // Add data based on current mode
      if (!state.geojsonLayer) return;

      if (mapMode === 'proportional') {
        createProportionalSymbols(data);
        // Also add to geojsonLayer for selection/restore functionality
        state.geojsonLayer.addData(data);
        if (state.map) {
          state.geojsonLayer.removeFrom(state.map); // Hide polygons, show circles
        }
      } else {
        state.geojsonLayer.addData(data);
      }

      // Fit bounds
      // Establish stable geographic bounds from polygon geometry only (circles can extend beyond)
      if (
        !state.baseDistrictBounds &&
        state.geojsonLayer.getBounds &&
        state.geojsonLayer.getBounds().isValid()
      ) {
        state.baseDistrictBounds = state.geojsonLayer.getBounds();
      }

      // Check if city/precincts are in URL - if so, fit to those instead of all districts
      let boundsToFit: LatLngBounds | null = null;

      // Default to city of Alameda if no hash parameters are present (empty hash or no hash)
      const hasHash = window.location.hash && window.location.hash.length > 1;
      if (!hasHash && !hashParams.city && !hashParams.precincts && !hashParams.mode) {
        hashParams.city = 'alameda';
        const defaultHash = buildHashParams(hashParams);
        window.location.hash = defaultHash;
      }

      if (hashParams.city || hashParams.precincts) {
        // Mark that we've already handled fitBounds during initial load
        // This prevents restoreSelectionFromURL from calling fitBounds again
        state.restoreInProgress = true;
      }

      if (hashParams.city) {
        // Find precincts by matching city property
        const normalizedCityName = normalizeCityName(hashParams.city);

        // Rewrite URL to kebab-case if it was snake_case
        if (hashParams.city !== normalizedCityName) {
          hashParams.city = normalizedCityName;
          const newHash = buildHashParams(hashParams);
          window.location.hash = newHash;
        }

        // Calculate bounds of precincts matching the city
        const selectedBounds = leaflet.latLngBounds([]);
        if (!state.geojsonLayer) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet layer iteration API
        state.geojsonLayer.eachLayer((layer: any) => {
          const feature = layer.feature;
          if (!feature) return;
          const props = feature.properties;
          const featureCity = safeGet<string | null>(props, 'city', null);
          const displayCity = getDisplayCityName(featureCity);
          const normalizedFeatureCity = normalizeCityName(displayCity);

          if (normalizedFeatureCity === normalizedCityName) {
            try {
              const tmp = leaflet.geoJSON(feature);
              const b = tmp.getBounds();
              if (b && b.isValid()) selectedBounds.extend(b);
            } catch (_e) {
              // Skip if bounds can't be calculated
            }
          }
        });
        if (selectedBounds.isValid()) {
          boundsToFit = selectedBounds;
        }
      } else if (hashParams.precincts) {
        const precinctIds = hashParams.precincts.split(/[+,]/);
        const selectedBounds = leaflet.latLngBounds([]);
        if (!state.geojsonLayer) return;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet layer iteration API
        state.geojsonLayer.eachLayer((layer: any) => {
          const feature = layer.feature;
          if (!feature) return;
          const props = feature.properties;
          const precinctId = getPrecinctId(props);
          const precinctIdStr = precinctId ? precinctId.toString() : null;
          if (precinctIdStr && precinctIds.indexOf(precinctIdStr) !== -1) {
            try {
              const tmp = leaflet.geoJSON(feature);
              const b = tmp.getBounds();
              if (b && b.isValid()) selectedBounds.extend(b);
            } catch (_e) {
              // Skip if bounds can't be calculated
            }
          }
        });
        if (selectedBounds.isValid()) {
          boundsToFit = selectedBounds;
        }
      }

      // If no selected bounds, use all districts
      if (!boundsToFit) {
        boundsToFit =
          state.baseDistrictBounds ||
          (state.geojsonLayer &&
          state.geojsonLayer.getBounds &&
          state.geojsonLayer.getBounds().isValid()
            ? state.geojsonLayer.getBounds()
            : null);
      }

      if (boundsToFit && state.map) {
        const isMobileInit = window.innerWidth <= 768;
        const bottomPanelInit = document.getElementById('bottom-panel');
        const bottomPaddingInit = bottomPanelInit
          ? bottomPanelInit.offsetHeight + (isMobileInit ? 140 : 80)
          : isMobileInit
            ? 360
            : 240;
        const sidePaddingInit = isMobileInit ? 50 : 80;
        // Shift city down by 100px on mobile (increase top padding)
        const topPaddingInit = isMobileInit ? 150 : 80;
        state.map.fitBounds(boundsToFit, {
          paddingTopLeft: leaflet.point(sidePaddingInit, topPaddingInit),
          paddingBottomRight: leaflet.point(sidePaddingInit, bottomPaddingInit),
        });
      }

      // Update info section with county totals
      updateInfoSection(null);

      // Update button text based on initial mode
      const btn = document.getElementById('toggle-mode-btn');
      if (btn) {
        btn.textContent =
          mapMode === 'proportional' ? 'Mode – Proportional Districts' : 'Mode – Shaded Districts';
      }

      // Restore selection from URL if present (do this first to set currentCityName)
      restoreSelectionFromURL();

      // Update city button text after initial load
      updateCityButtonText();

      // Don't set initial hash - only update URL when user actually changes mode
      // This preserves URLs like #city/alameda without adding mode/shaded/

      // Listen for hash changes (back/forward navigation)
      if (!state.hashListenerBound) {
        window.addEventListener('hashchange', async () => {
          const hashParams = parseHashParams();
          const newMode = hashParams.mode === 'proportional' ? 'proportional' : 'shaded';

          // Check if election or contest changed - if so, reload data
          const electionChanged = hashParams.election !== state.selectedElection;
          const contestChanged =
            hashParams.contest !== state.selectedContestId &&
            (hashParams.contest !== null || state.selectedContestId !== null);

          if (electionChanged || contestChanged) {
            // Reload data for new election/contest
            loadData();
            return;
          }

          // Update mode if changed
          const { mapMode } = await import('./map-mode.js');
          if (newMode !== mapMode) {
            // Update mapMode in map-mode.ts
            // This will be handled by toggleMapMode
            toggleMapMode();
          }

          // Restore selection
          restoreSelectionFromURL();
        });
        state.hashListenerBound = true;
      }
    })
    .catch((error: Error) => {
      console.error('Error loading data:', error);
      alert(
        'Error loading map data: ' +
          error.message +
          '\n\nMake sure precincts_consolidated.geojson and data/results/results.json are in the correct locations and that you are accessing the page through a web server (not file://).'
      );
    });
}

// Start initialization
initGeoJSONLayer();
