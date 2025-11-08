// ============================================================================
// SELECTION
// ============================================================================

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
    
    // Aggregate vote_method data
    var mailInAggregated = {
        yes: 0,
        no: 0,
        total: 0
    };
    var inPersonAggregated = {
        yes: 0,
        no: 0,
        total: 0
    };
    
    selectedPrecincts.forEach(function(item) {
        var props = item.feature.properties;
        if (props.votes) {
            if (props.votes.yes) aggregated.yes += props.votes.yes;
            if (props.votes.no) aggregated.no += props.votes.no;
            if (props.votes.total) aggregated.total += props.votes.total;
        }
        
        // Aggregate vote_method data
        if (props.vote_method) {
            if (props.vote_method.mail_in && props.vote_method.mail_in.votes) {
                var mailIn = props.vote_method.mail_in.votes;
                if (mailIn.yes) mailInAggregated.yes += mailIn.yes;
                if (mailIn.no) mailInAggregated.no += mailIn.no;
                if (mailIn.total) mailInAggregated.total += mailIn.total;
            }
            if (props.vote_method.in_person && props.vote_method.in_person.votes) {
                var inPerson = props.vote_method.in_person.votes;
                if (inPerson.yes) inPersonAggregated.yes += inPerson.yes;
                if (inPerson.no) inPersonAggregated.no += inPerson.no;
                if (inPerson.total) inPersonAggregated.total += inPerson.total;
            }
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
    
    // Calculate vote_method percentages
    var voteMethod = null;
    if (mailInAggregated.total > 0 || inPersonAggregated.total > 0) {
        voteMethod = {
            mail_in: {
                votes: mailInAggregated,
                percentage: {
                    yes: mailInAggregated.total > 0 ? (mailInAggregated.yes / mailInAggregated.total) * 100 : 0,
                    no: mailInAggregated.total > 0 ? (mailInAggregated.no / mailInAggregated.total) * 100 : 0
                },
                percentage_of_total: aggregated.total > 0 ? (mailInAggregated.total / aggregated.total) * 100 : 0
            },
            in_person: {
                votes: inPersonAggregated,
                percentage: {
                    yes: inPersonAggregated.total > 0 ? (inPersonAggregated.yes / inPersonAggregated.total) * 100 : 0,
                    no: inPersonAggregated.total > 0 ? (inPersonAggregated.no / inPersonAggregated.total) * 100 : 0
                },
                percentage_of_total: aggregated.total > 0 ? (inPersonAggregated.total / aggregated.total) * 100 : 0
            }
        };
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
    
    // Add vote_method if available
    if (voteMethod) {
        aggregatedProps.vote_method = voteMethod;
    }
    
    updateInfoSection(aggregatedProps);
}

