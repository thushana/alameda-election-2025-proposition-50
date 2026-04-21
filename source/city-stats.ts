// ============================================================================
// CITY STATISTICS
// ============================================================================

import { safeGet, getPrecinctId } from './data-helpers.js';
import { getDisplayCityName, normalizeCityName } from './city-helpers.js';
import type {
  GeoJSONData,
  CityStats,
  FeatureProperties,
  ContestResults,
  CandidateVotes,
} from './types.js';
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

/**
 * Sum candidate votes for a contest across a list of precinct feature property objects
 * (e.g. all selected precincts, or a city / county scope).
 */
export function aggregateContestVotesFromFeatures(
  propsList: FeatureProperties[],
  contestId: number,
  contestName: string
): ContestResults | null {
  const votesById = new Map<number, number>();
  const namesById = new Map<number, string>();

  // One row per precinct (selection or snapshot can list the same precinct twice)
  const seenPrecinct = new Set<string>();
  const uniqueProps: FeatureProperties[] = [];
  for (const props of propsList) {
    const pid = getPrecinctId(props);
    const key = pid !== null && pid !== undefined && pid !== '' ? String(pid) : '';
    if (key) {
      if (seenPrecinct.has(key)) continue;
      seenPrecinct.add(key);
    }
    uniqueProps.push(props);
  }

  for (const props of uniqueProps) {
    const c = props.contests?.[contestId];
    if (!c?.candidates?.length) continue;
    for (const cand of c.candidates) {
      votesById.set(cand.candidateId, (votesById.get(cand.candidateId) ?? 0) + cand.votes);
      if (!namesById.has(cand.candidateId)) {
        namesById.set(cand.candidateId, cand.candidateName);
      }
    }
  }

  if (votesById.size === 0) {
    return null;
  }

  const totalVotes = [...votesById.values()].reduce((a, b) => a + b, 0);
  const candidates: CandidateVotes[] = [...votesById.entries()]
    .map(([candidateId, votes]) => ({
      candidateId,
      candidateName: namesById.get(candidateId) ?? '',
      votes,
      percentage: totalVotes > 0 ? (votes / totalVotes) * 100 : 0,
    }))
    .sort((a, b) => b.votes - a.votes);

  return {
    contestId,
    contestName,
    candidates,
    totalVotes,
  };
}

/** Aggregate one contest across all precincts in the snapshot, optionally filtered to one city */
export function aggregateContestFromGeoJSON(
  data: GeoJSONData,
  contestId: number,
  normalizedCityKey: string | null
): ContestResults | null {
  const propsList: FeatureProperties[] = [];
  const seenPrecinct = new Set<string>();
  for (const f of data.features) {
    const props = f.properties;
    if (normalizedCityKey !== null) {
      const city = safeGet<string | null>(props, 'city', null);
      const displayCity = getDisplayCityName(city);
      const n = normalizeCityName(displayCity);
      if (n !== normalizedCityKey) continue;
    }
    const pid = getPrecinctId(props);
    if (pid !== null && pid !== undefined && pid !== '') {
      const pk = String(pid);
      if (seenPrecinct.has(pk)) continue;
      seenPrecinct.add(pk);
    }
    propsList.push(props);
  }

  const name = state.contests[contestId]?.contestName ?? '';
  return aggregateContestVotesFromFeatures(propsList, contestId, name);
}
