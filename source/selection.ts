// ============================================================================
// SELECTION
// ============================================================================

import { state } from './state.js';
import { updateInfoSection } from './ui-info-section.js';
import { aggregateContestVotesFromFeatures } from './city-stats.js';
import { isYesNoContest, getPrecinctId } from './data-helpers.js';
import type { FeatureProperties, VoteMethod } from './types.js';

function uniqueSelectedPrecincts(): typeof state.selectedPrecincts {
  const seen = new Set<string>();
  const out: typeof state.selectedPrecincts = [];
  for (const item of state.selectedPrecincts) {
    const pid = getPrecinctId(item.feature.properties);
    const key = pid !== null && pid !== undefined && String(pid) !== '' ? String(pid) : '';
    if (key !== '') {
      if (seen.has(key)) continue;
      seen.add(key);
    }
    out.push(item);
  }
  return out;
}

// Calculate and display aggregated totals
export function updateAggregatedTotals(): void {
  if (state.selectedPrecincts.length === 0) {
    updateInfoSection(null);
    return;
  }

  const selected = uniqueSelectedPrecincts();

  const aggregated = {
    yes: 0,
    no: 0,
    total: 0,
    count: selected.length,
  };

  // Aggregate vote_method data
  const mailInAggregated = {
    yes: 0,
    no: 0,
    total: 0,
  };
  const inPersonAggregated = {
    yes: 0,
    no: 0,
    total: 0,
  };

  selected.forEach((item) => {
    const props = item.feature.properties;
    if (props.votes) {
      if (props.votes.yes) aggregated.yes += props.votes.yes;
      if (props.votes.no) aggregated.no += props.votes.no;
      if (props.votes.total) aggregated.total += props.votes.total;
    }

    // Aggregate vote_method data
    if (props.vote_method) {
      if (props.vote_method.mail_in && props.vote_method.mail_in.votes) {
        const mailIn = props.vote_method.mail_in.votes;
        if (mailIn.yes) mailInAggregated.yes += mailIn.yes;
        if (mailIn.no) mailInAggregated.no += mailIn.no;
        if (mailIn.total) mailInAggregated.total += mailIn.total;
      }
      if (props.vote_method.in_person && props.vote_method.in_person.votes) {
        const inPerson = props.vote_method.in_person.votes;
        if (inPerson.yes) inPersonAggregated.yes += inPerson.yes;
        if (inPerson.no) inPersonAggregated.no += inPerson.no;
        if (inPerson.total) inPersonAggregated.total += inPerson.total;
      }
    }
  });

  // Calculate percentages
  let yesPct = 0;
  let noPct = 0;
  if (aggregated.total > 0) {
    yesPct = (aggregated.yes / aggregated.total) * 100;
    noPct = (aggregated.no / aggregated.total) * 100;
  }

  // Calculate vote_method percentages
  let voteMethod: VoteMethod | null = null;
  if (mailInAggregated.total > 0 || inPersonAggregated.total > 0) {
    voteMethod = {
      mail_in: {
        votes: mailInAggregated,
        percentage: {
          yes:
            mailInAggregated.total > 0 ? (mailInAggregated.yes / mailInAggregated.total) * 100 : 0,
          no: mailInAggregated.total > 0 ? (mailInAggregated.no / mailInAggregated.total) * 100 : 0,
        },
        percentage_of_total:
          aggregated.total > 0 ? (mailInAggregated.total / aggregated.total) * 100 : 0,
      },
      in_person: {
        votes: inPersonAggregated,
        percentage: {
          yes:
            inPersonAggregated.total > 0
              ? (inPersonAggregated.yes / inPersonAggregated.total) * 100
              : 0,
          no:
            inPersonAggregated.total > 0
              ? (inPersonAggregated.no / inPersonAggregated.total) * 100
              : 0,
        },
        percentage_of_total:
          aggregated.total > 0 ? (inPersonAggregated.total / aggregated.total) * 100 : 0,
      },
    };
  }

  // Create aggregated properties object
  const aggregatedProps: FeatureProperties = {
    aggregated: true,
    count: aggregated.count,
    cityName: state.currentCityName || undefined,
    votes: {
      yes: aggregated.yes,
      no: aggregated.no,
      total: aggregated.total,
    },
    percentage: {
      yes: yesPct,
      no: noPct,
    },
  };

  // Add vote_method if available
  if (voteMethod) {
    aggregatedProps.vote_method = voteMethod;
  }

  // Multi-candidate contests: aggregate full candidate totals (legacy votes yes/no alone is wrong)
  if (state.selectedContestId !== null && state.selectedContestId !== undefined) {
    const cid = state.selectedContestId;
    const propsList = selected.map((item) => item.feature.properties);
    const sample = propsList.find((p) => p.contests?.[cid]);
    const sampleContest = sample?.contests?.[cid];
    if (sampleContest && !isYesNoContest(sampleContest)) {
      const agg = aggregateContestVotesFromFeatures(
        propsList,
        cid,
        state.contests[cid]?.contestName ?? sampleContest.contestName
      );
      if (agg) {
        aggregatedProps.contests = { [cid]: agg };
      }
    }
  }

  updateInfoSection(aggregatedProps);
}
