// ============================================================================
// UI INFO SECTION
// ============================================================================
import { state } from './state.js';
import { SIZES, OPACITY } from './constants.js';
import { safeGet } from './data-helpers.js';
import { generateVoteMethodBarGraph, generateMethodBreakdownBarGraph } from './ui-bar-graphs.js';
// Helper function to generate county totals HTML
export function generateCountyTotalsHTML() {
    return `
    <div class="precinct-name">Alameda County</div>
    <div class="data-columns">
      <div class="data-column">
        <div class="data-column-header">YES</div>
        <div class="data-column-votes">${state.countyTotals.yes.toLocaleString()} votes</div>
        <div class="data-column-percent">${state.countyTotals.yesPct.toFixed(1)}%</div>
      </div>
      <div class="data-column">
        <div class="data-column-header">Total</div>
        <div class="data-column-votes">${state.countyTotals.total.toLocaleString()} votes</div>
        <div class="data-column-percent">—</div>
      </div>
      <div class="data-column">
        <div class="data-column-header">NO</div>
        <div class="data-column-votes">${state.countyTotals.no.toLocaleString()} votes</div>
        <div class="data-column-percent">${state.countyTotals.noPct.toFixed(1)}%</div>
      </div>
    </div>
    <div class="bar-graph">
      <div class="bar-graph-yes" style="width: ${state.countyTotals.yesPct}%;"></div>
      <div class="bar-graph-no" style="width: ${state.countyTotals.noPct}%;"></div>
    </div>
  `;
}
// Helper function to get title from props
export function getTitleFromProps(props) {
    if (props.aggregated) {
        if (props.cityName) {
            return 'City of ' + props.cityName.charAt(0).toUpperCase() + props.cityName.slice(1);
        }
        return (props.count || 0) + ' Precincts Selected';
    }
    const precinctName = safeGet(props, 'Precinct_ID', null) ||
        safeGet(props, 'precinct', null) ||
        safeGet(props, 'ID', null) ||
        'N/A';
    // Get neighborhood and city
    const neighborhood = safeGet(props, 'neighborhood', null);
    const city = safeGet(props, 'city', null);
    // Build title with neighborhood and city if available
    const titleParts = [];
    if (neighborhood) {
        titleParts.push(neighborhood);
    }
    if (city) {
        titleParts.push(city);
    }
    if (titleParts.length > 0) {
        return titleParts.join(', ') + ' – Precinct ' + precinctName;
    }
    // Fallback to just precinct number if no location data
    return 'Precinct ' + precinctName;
}
// Helper function to extract vote data from props
export function extractVoteData(props) {
    const hasVotes = !!(props && props.votes && typeof props.votes.total === 'number' && props.votes.total > 0);
    if (!hasVotes || !props) {
        return {
            hasVotes: false,
            yesPct: 0,
            yesVotes: 0,
            noPct: 0,
            noVotes: 0,
            totalVotes: 0
        };
    }
    return {
        hasVotes: true,
        yesPct: safeGet(props, 'percentage.yes', 0),
        yesVotes: safeGet(props, 'votes.yes', 0),
        noPct: safeGet(props, 'percentage.no', 0),
        noVotes: safeGet(props, 'votes.no', 0),
        totalVotes: safeGet(props, 'votes.total', 0)
    };
}
// Helper function to generate main bar graph HTML
export function generateMainBarGraphHTML(voteData) {
    if (!voteData.hasVotes || voteData.totalVotes === 0) {
        return '';
    }
    const countyMarker = (state.countyTotals.yesPct !== undefined) ? `
    <div class="bar-graph-county-marker" style="left: ${state.countyTotals.yesPct}%;">
      <div class="bar-graph-county-line"></div>
    </div>
  ` : '';
    const countyLabel = (state.countyTotals.yesPct !== undefined) ? `
    <div class="bar-graph-county-label" style="position: absolute; left: ${state.countyTotals.yesPct}%; transform: translateX(-50%); bottom: -18px; padding-bottom: 2px;">County Avg.</div>
  ` : '';
    return `
    <div style="position: relative;">
      <div class="bar-graph">
        <div class="bar-graph-yes" style="width: ${voteData.yesPct}%;"></div>
        <div class="bar-graph-no" style="width: ${voteData.noPct}%;"></div>
        ${countyMarker}
      </div>
      ${countyLabel}
    </div>
  `;
}
// Helper function to generate data columns HTML
export function generateDataColumnsHTML(voteData) {
    const yesDisplay = voteData.hasVotes ? voteData.yesVotes.toLocaleString() + ' votes' : '&nbsp;';
    const yesPctDisplay = voteData.hasVotes ? voteData.yesPct.toFixed(1) + '%' : '&nbsp;';
    const totalDisplay = voteData.hasVotes ? voteData.totalVotes.toLocaleString() + ' votes' : '&nbsp;';
    const noDisplay = voteData.hasVotes ? voteData.noVotes.toLocaleString() + ' votes' : '&nbsp;';
    const noPctDisplay = voteData.hasVotes ? voteData.noPct.toFixed(1) + '%' : '&nbsp;';
    return `
    <div class="data-columns">
      <div class="data-column">
        <div class="data-column-header">YES</div>
        <div class="data-column-votes">${yesDisplay}</div>
        <div class="data-column-percent">${yesPctDisplay}</div>
      </div>
      <div class="data-column">
        <div class="data-column-header">Total</div>
        <div class="data-column-votes">${totalDisplay}</div>
        <div class="data-column-percent">—</div>
      </div>
      <div class="data-column">
        <div class="data-column-header">NO</div>
        <div class="data-column-votes">${noDisplay}</div>
        <div class="data-column-percent">${noPctDisplay}</div>
      </div>
    </div>
  `;
}
// Helper function to generate vote method breakdown HTML
export function generateVoteMethodBreakdownHTML(props, voteData) {
    if (!voteData.hasVotes || !props.vote_method || typeof props.vote_method !== 'object') {
        return '';
    }
    const mailIn = safeGet(props, 'vote_method.mail_in', {});
    const inPerson = safeGet(props, 'vote_method.in_person', {});
    const mailInVotes = safeGet(mailIn, 'votes', {});
    const inPersonVotes = safeGet(inPerson, 'votes', {});
    const mailInPct = safeGet(mailIn, 'percentage', {});
    const inPersonPct = safeGet(inPerson, 'percentage', {});
    const mailInYesPct = safeGet(mailInPct, 'yes', 0);
    const mailInNoPct = safeGet(mailInPct, 'no', 0);
    const inPersonYesPct = safeGet(inPersonPct, 'yes', 0);
    const inPersonNoPct = safeGet(inPersonPct, 'no', 0);
    const mailInPctOfTotal = safeGet(mailIn, 'percentage_of_total', 0);
    const inPersonPctOfTotal = safeGet(inPerson, 'percentage_of_total', 0);
    const methodBreakdownTotal = (safeGet(mailInVotes, 'total', 0) || 0) + (safeGet(inPersonVotes, 'total', 0) || 0);
    return `
    <div class="vote-method-breakdown" style="margin-top: ${SIZES.MARGIN_TOP_SECTION}; padding-top: ${SIZES.MARGIN_TOP_SECTION}; border-top: 1px solid ${OPACITY.BORDER_LIGHT};">
      <div class="vote-method-header" onclick="toggleVoteMethodSection(this)">
        <span>Vote Method</span>
        <span class="vote-method-arrow">›</span>
      </div>
      <div class="vote-method-content">
        ${generateVoteMethodBarGraph({
        yesPct: mailInYesPct,
        noPct: mailInNoPct,
        totalVotes: safeGet(mailInVotes, 'total', 0) || 0,
        label: 'MAIL IN',
        countyAvgPct: state.countyTotals.mailInYesPct
    })}
                  ${generateVoteMethodBarGraph({
        yesPct: inPersonYesPct,
        noPct: inPersonNoPct,
        totalVotes: safeGet(inPersonVotes, 'total', 0) || 0,
        label: 'IN PERSON',
        countyAvgPct: state.countyTotals.inPersonYesPct
    })}
                  ${generateMethodBreakdownBarGraph({
        mailInPct: mailInPctOfTotal,
        inPersonPct: inPersonPctOfTotal,
        totalVotes: methodBreakdownTotal,
        countyAvgPct: state.countyTotals.mailInPctOfTotal
    })}
      </div>
    </div>
  `;
}
// Toggle vote method section
export function toggleVoteMethodSection(header) {
    const content = header.nextElementSibling;
    const arrow = header.querySelector('.vote-method-arrow');
    if (content && content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        if (arrow)
            arrow.classList.remove('expanded');
        state.voteMethodSectionExpanded = false;
    }
    else {
        if (content)
            content.classList.add('expanded');
        if (arrow)
            arrow.classList.add('expanded');
        state.voteMethodSectionExpanded = true;
    }
}
// Make toggleVoteMethodSection globally accessible
window.toggleVoteMethodSection = toggleVoteMethodSection;
// Update info section in bottom panel
export function updateInfoSection(props) {
    const infoSection = document.getElementById('info-section');
    if (!infoSection)
        return;
    const bottomPanelContent = infoSection.parentElement;
    if (!bottomPanelContent)
        return;
    // Get current height
    const currentHeight = bottomPanelContent.offsetHeight;
    bottomPanelContent.style.height = currentHeight + 'px';
    // Fade out
    infoSection.style.opacity = '0';
    setTimeout(() => {
        let content;
        if (!props) {
            // Show county totals
            content = generateCountyTotalsHTML();
        }
        else {
            // Generate content for precinct or aggregated data
            const title = getTitleFromProps(props);
            const voteData = extractVoteData(props);
            content = `
        <div class="precinct-name">${title}</div>
        ${generateDataColumnsHTML(voteData)}
        ${generateMainBarGraphHTML(voteData)}
        ${generateVoteMethodBreakdownHTML(props, voteData)}
      `;
        }
        infoSection.innerHTML = content;
        // Restore vote method section expanded state if it was previously expanded
        if (state.voteMethodSectionExpanded) {
            const voteMethodHeader = infoSection.querySelector('.vote-method-header');
            if (voteMethodHeader) {
                const voteMethodContent = voteMethodHeader.nextElementSibling;
                const voteMethodArrow = voteMethodHeader.querySelector('.vote-method-arrow');
                if (voteMethodContent && voteMethodArrow) {
                    voteMethodContent.classList.add('expanded');
                    voteMethodArrow.classList.add('expanded');
                }
            }
        }
        // Get new height and transition
        setTimeout(() => {
            const newHeight = bottomPanelContent.scrollHeight;
            bottomPanelContent.style.height = newHeight + 'px';
            // Fade in
            infoSection.style.opacity = '1';
            // Remove height constraint after transition
            setTimeout(() => {
                bottomPanelContent.style.height = 'auto';
            }, 400);
        }, 10);
    }, 150);
}
