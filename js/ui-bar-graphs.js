// ============================================================================
// UI BAR GRAPHS
// ============================================================================

// Helper function to generate a vote method bar graph
function generateVoteMethodBarGraph(config) {
    var yesPct = config.yesPct || 0;
    var noPct = config.noPct || 0;
    var totalVotes = config.totalVotes || 0;
    var label = config.label || '';
    var countyAvgPct = config.countyAvgPct;
    var yesColor = config.yesColor || COLORS.YES;
    var noColor = config.noColor || COLORS.NO;
    
    if (totalVotes === 0) {
        return '';
    }
    
    var html = `
        <div class="vote-method-bar-wrapper" style="margin-bottom: ${SIZES.MARGIN_BOTTOM_MEDIUM};">
            <div class="vote-method-label-row" style="position: relative; margin-bottom: ${SIZES.MARGIN_BOTTOM_SMALL}; font-size: ${SIZES.FONT_SMALL}; font-weight: 500; color: ${OPACITY.TEXT_PRIMARY}; padding: 0; width: 100%;">
                <span>${yesPct.toFixed(1)}%</span>
                <span style="position: absolute; left: 50%; transform: translateX(-50%); font-size: ${SIZES.FONT_XSMALL}; color: ${OPACITY.TEXT_SECONDARY}; font-weight: normal;">${label} – ${totalVotes.toLocaleString()} votes</span>
                <span>${noPct.toFixed(1)}%</span>
            </div>
            <div class="bar-graph" style="height: ${SIZES.BAR_GRAPH_HEIGHT}; position: relative; display: flex; overflow: hidden; border-radius: ${SIZES.BAR_GRAPH_BORDER_RADIUS}; background: ${OPACITY.BACKGROUND_LIGHT}; margin: 0; width: 100%;">
                <div class="bar-graph-yes" style="width: ${yesPct}%; height: 100%; background: ${yesColor}; flex-shrink: 0;"></div>
                <div class="bar-graph-no" style="width: ${noPct}%; height: 100%; background: ${noColor}; flex-shrink: 0;"></div>
                ${countyAvgPct !== undefined ? `
                <div class="bar-graph-county-marker" style="left: ${countyAvgPct}%;">
                    <div class="bar-graph-county-line"></div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return html;
}

// Helper function to generate method breakdown bar graph
function generateMethodBreakdownBarGraph(config) {
    var mailInPct = config.mailInPct || 0;
    var inPersonPct = config.inPersonPct || 0;
    var totalVotes = config.totalVotes || 0;
    var countyAvgPct = config.countyAvgPct;
    var mailInColor = config.mailInColor || COLORS.METHOD_MAIL_IN;
    var inPersonColor = config.inPersonColor || COLORS.METHOD_IN_PERSON;
    
    if (mailInPct === 0 && inPersonPct === 0) {
        return '';
    }
    
    var html = `
        <div class="vote-method-bar-wrapper" style="margin-bottom: ${SIZES.MARGIN_BOTTOM_MEDIUM};">
            <div class="vote-method-label-row" style="position: relative; margin-bottom: ${SIZES.MARGIN_BOTTOM_SMALL}; font-size: ${SIZES.FONT_SMALL}; font-weight: 500; color: ${OPACITY.TEXT_PRIMARY}; padding: 0; width: 100%;">
                <span>${mailInPct.toFixed(1)}% – MAIL IN</span>
                <span style="position: absolute; left: 50%; transform: translateX(-50%); font-size: ${SIZES.FONT_XSMALL}; color: ${OPACITY.TEXT_SECONDARY}; font-weight: normal;">METHOD</span>
                <span>IN PERSON – ${inPersonPct.toFixed(1)}%</span>
            </div>
            <div class="bar-graph" style="height: ${SIZES.BAR_GRAPH_HEIGHT}; position: relative; display: flex; overflow: hidden; border-radius: ${SIZES.BAR_GRAPH_BORDER_RADIUS}; background: ${OPACITY.BACKGROUND_LIGHT}; margin: 0; width: 100%;">
                <div style="width: ${mailInPct}%; height: 100%; background: ${mailInColor}; flex-shrink: 0;"></div>
                <div style="width: ${inPersonPct}%; height: 100%; background: ${inPersonColor}; flex-shrink: 0;"></div>
                ${countyAvgPct !== undefined ? `
                <div class="bar-graph-county-marker" style="left: ${countyAvgPct}%;">
                    <div class="bar-graph-county-line"></div>
                </div>
                ` : ''}
            </div>
        </div>
    `;
    
    return html;
}

