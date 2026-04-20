// ============================================================================
// UI LEGEND
// ============================================================================

import { COLORS, MULTI_LEADER_PALETTE } from './constants.js';
import { state } from './state.js';

/** Rebuild the map legend for YES/NO ramp vs multi-candidate leader colors */
export function refreshMapLegend(): void {
  const legendContainer = document.getElementById('legend-horizontal');
  if (!legendContainer) return;

  legendContainer.innerHTML = '';

  if (state.mapUsesMultiCandidateColors && state.multiCandidateColorOrder?.length) {
    state.multiCandidateColorOrder.forEach((candidateId, idx) => {
      const raw = state.multiCandidateNames[candidateId] ?? `Candidate ${candidateId}`;
      const label = raw.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
      const color = MULTI_LEADER_PALETTE[idx % MULTI_LEADER_PALETTE.length];
      const div = document.createElement('div');
      div.className = 'legend-item';
      div.innerHTML =
        '<div class="legend-color" style="background:' +
        color +
        '"></div><span>' +
        label +
        '</span>';
      legendContainer.appendChild(div);
    });
    const nodata = document.createElement('div');
    nodata.className = 'legend-item';
    nodata.innerHTML =
      '<div class="legend-color" style="background:' +
      COLORS.NO_DATA +
      '"></div><span>No votes</span>';
    legendContainer.appendChild(nodata);
    return;
  }

  const legendItems: [string, string][] = [
    ['0&ndash;50%', COLORS.RED_SHADE],
    ['50%+', COLORS.GREEN_50],
    ['75%+', COLORS.GREEN_75],
    ['80%+', COLORS.GREEN_80],
    ['85%+', COLORS.GREEN_85],
    ['90%+', COLORS.GREEN_90],
    ['95%+', COLORS.GREEN_95],
    ['No data', COLORS.NO_DATA],
  ];

  legendItems.forEach((item) => {
    const div = document.createElement('div');
    div.className = 'legend-item';
    div.innerHTML =
      '<div class="legend-color" style="background:' +
      item[1] +
      '"></div><span>' +
      item[0] +
      '</span>';
    legendContainer.appendChild(div);
  });
}

// Create horizontal legend (initial + whenever contest/election changes)
export function createHorizontalLegend(): void {
  refreshMapLegend();
}
