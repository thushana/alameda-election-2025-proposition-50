// ============================================================================
// CITY STATISTICS
// ============================================================================

import { safeGet } from './data-helpers.js';
import { getDisplayCityName, normalizeCityName } from './city-helpers.js';
import type { GeoJSONData, CityStats } from './types.js';
import { state } from './state.js';

// Calculate city statistics from GeoJSON data
export function calculateCityStats(data: GeoJSONData): CityStats {
  const stats: CityStats = {};

  if (!data || !data.features) {
    return stats;
  }

  data.features.forEach((feature) => {
    const props = feature.properties;
    const city = safeGet<string | null>(props, 'city', null);

    if (!city) return;

    // Get display city name (treats "Alameda County" as "Unincorporated Alameda County")
    const displayCity = getDisplayCityName(city);

    if (!displayCity) return;

    // Normalize city name for grouping
    const normalizedCity = normalizeCityName(displayCity);
    if (!normalizedCity) return;

    if (!stats[normalizedCity]) {
      stats[normalizedCity] = {
        name: displayCity,
        yes: 0,
        no: 0,
        total: 0,
        yesPct: 0,
      };
    }

    // Aggregate votes - try new format first, then legacy
    if (props.contests && state.selectedContestId && props.contests[state.selectedContestId]) {
      const contest = props.contests[state.selectedContestId];
      // Check if it's a yes/no contest
      const yesCandidate = contest.candidates.find((c) =>
        c.candidateName.toUpperCase().includes('YES')
      );
      const noCandidate = contest.candidates.find((c) =>
        c.candidateName.toUpperCase().includes('NO')
      );
      if (yesCandidate && noCandidate) {
        stats[normalizedCity].yes += yesCandidate.votes;
        stats[normalizedCity].no += noCandidate.votes;
        stats[normalizedCity].total += contest.totalVotes;
      }
    } else if (props.votes) {
      // Legacy format
      if (props.votes.yes) stats[normalizedCity].yes += props.votes.yes;
      if (props.votes.no) stats[normalizedCity].no += props.votes.no;
      if (props.votes.total) stats[normalizedCity].total += props.votes.total;
    }
  });

  // Calculate percentages
  Object.keys(stats).forEach((key) => {
    const city = stats[key];
    if (city.total > 0) {
      city.yesPct = (city.yes / city.total) * 100;
    } else {
      city.yesPct = 0;
    }
  });

  return stats;
}
