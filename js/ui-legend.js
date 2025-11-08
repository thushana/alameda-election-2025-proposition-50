// ============================================================================
// UI LEGEND
// ============================================================================
import { COLORS } from './constants.js';
// Create horizontal legend
export function createHorizontalLegend() {
    const legendContainer = document.getElementById('legend-horizontal');
    if (!legendContainer)
        return;
    // Legend items: [label, color]
    const legendItems = [
        ['0&ndash;50%', COLORS.RED_SHADE], // Red shade
        ['50%+', COLORS.GREEN_50], // 50-75%
        ['75%+', COLORS.GREEN_75], // 75-80%
        ['80%+', COLORS.GREEN_80], // 80-85%
        ['85%+', COLORS.GREEN_85], // 85-90%
        ['90%+', COLORS.GREEN_90], // 90-95%
        ['95%+', COLORS.GREEN_95], // 95-100%
        ['No data', COLORS.NO_DATA] // No data (gray)
    ];
    legendItems.forEach((item) => {
        const div = document.createElement('div');
        div.className = 'legend-item';
        div.innerHTML = '<div class="legend-color" style="background:' + item[1] + '"></div><span>' + item[0] + '</span>';
        legendContainer.appendChild(div);
    });
}
