// ============================================================================
// SELECTION
// ============================================================================

import { state } from './state.js';
import { updateInfoSection } from './ui-info-section.js';
import type { FeatureProperties, VoteMethod } from './types.js';

// Calculate and display aggregated totals
export function updateAggregatedTotals(): void {
  if (state.selectedPrecincts.length === 0) {
    updateInfoSection(null);
    return;
  }

  const aggregated = {
    yes: 0,
    no: 0,
    total: 0,
    count: state.selectedPrecincts.length,
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

  state.selectedPrecincts.forEach((item) => {
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

  updateInfoSection(aggregatedProps);
}
