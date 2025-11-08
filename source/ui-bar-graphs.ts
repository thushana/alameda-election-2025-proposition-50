// ============================================================================
// UI BAR GRAPHS
// ============================================================================

import { COLORS, SIZES, OPACITY } from './constants.js';
import type { VoteMethodBarGraphConfig, MethodBreakdownBarGraphConfig } from './types.js';

// Helper function to generate a vote method bar graph
export function generateVoteMethodBarGraph(config: VoteMethodBarGraphConfig): string {
  const yesPct = config.yesPct || 0;
  const noPct = config.noPct || 0;
  const totalVotes = config.totalVotes || 0;
  const label = config.label || '';
  const countyAvgPct = config.countyAvgPct;
  const yesColor = config.yesColor || COLORS.YES;
  const noColor = config.noColor || COLORS.NO;

  if (totalVotes === 0) {
    return '';
  }

  const html = `
    <div class="vote-method-bar-wrapper" style="margin-bottom: ${SIZES.MARGIN_BOTTOM_MEDIUM};">
      <div class="vote-method-label-row" style="position: relative; margin-bottom: ${SIZES.MARGIN_BOTTOM_SMALL}; font-size: ${SIZES.FONT_SMALL}; font-weight: 500; color: ${OPACITY.TEXT_PRIMARY}; padding: 0; width: 100%;">
        <span>${yesPct.toFixed(1)}%</span>
        <span style="position: absolute; left: 50%; transform: translateX(-50%); font-size: ${SIZES.FONT_XSMALL}; color: ${OPACITY.TEXT_SECONDARY}; font-weight: normal;">${label} – ${totalVotes.toLocaleString()} votes</span>
        <span>${noPct.toFixed(1)}%</span>
      </div>
      <div class="bar-graph" style="height: ${SIZES.BAR_GRAPH_HEIGHT}; position: relative; display: flex; overflow: hidden; border-radius: ${SIZES.BAR_GRAPH_BORDER_RADIUS}; background: ${OPACITY.BACKGROUND_LIGHT}; margin: 0; width: 100%;">
        <div class="bar-graph-yes" style="width: ${yesPct}%; height: 100%; background: ${yesColor}; flex-shrink: 0;"></div>
        <div class="bar-graph-no" style="width: ${noPct}%; height: 100%; background: ${noColor}; flex-shrink: 0;"></div>
        ${
          countyAvgPct !== undefined
            ? `
        <div class="bar-graph-county-marker" style="left: ${countyAvgPct}%;">
          <div class="bar-graph-county-line"></div>
        </div>
        `
            : ''
        }
      </div>
    </div>
  `;

  return html;
}

// Helper function to generate method breakdown bar graph
export function generateMethodBreakdownBarGraph(config: MethodBreakdownBarGraphConfig): string {
  const mailInPct = config.mailInPct || 0;
  const inPersonPct = config.inPersonPct || 0;
  const countyAvgPct = config.countyAvgPct;
  const mailInColor = config.mailInColor || COLORS.METHOD_MAIL_IN;
  const inPersonColor = config.inPersonColor || COLORS.METHOD_IN_PERSON;

  if (mailInPct === 0 && inPersonPct === 0) {
    return '';
  }

  const html = `
    <div class="vote-method-bar-wrapper" style="margin-bottom: ${SIZES.MARGIN_BOTTOM_MEDIUM};">
      <div class="vote-method-label-row" style="position: relative; margin-bottom: ${SIZES.MARGIN_BOTTOM_SMALL}; font-size: ${SIZES.FONT_SMALL}; font-weight: 500; color: ${OPACITY.TEXT_PRIMARY}; padding: 0; width: 100%;">
        <span>${mailInPct.toFixed(1)}% – MAIL IN</span>
        <span style="position: absolute; left: 50%; transform: translateX(-50%); font-size: ${SIZES.FONT_XSMALL}; color: ${OPACITY.TEXT_SECONDARY}; font-weight: normal;">METHOD</span>
        <span>IN PERSON – ${inPersonPct.toFixed(1)}%</span>
      </div>
      <div class="bar-graph" style="height: ${SIZES.BAR_GRAPH_HEIGHT}; position: relative; display: flex; overflow: hidden; border-radius: ${SIZES.BAR_GRAPH_BORDER_RADIUS}; background: ${OPACITY.BACKGROUND_LIGHT}; margin: 0; width: 100%;">
        <div style="width: ${mailInPct}%; height: 100%; background: ${mailInColor}; flex-shrink: 0;"></div>
        <div style="width: ${inPersonPct}%; height: 100%; background: ${inPersonColor}; flex-shrink: 0;"></div>
        ${
          countyAvgPct !== undefined
            ? `
        <div class="bar-graph-county-marker" style="left: ${countyAvgPct}%;">
          <div class="bar-graph-county-line"></div>
        </div>
        `
            : ''
        }
      </div>
    </div>
  `;

  return html;
}
