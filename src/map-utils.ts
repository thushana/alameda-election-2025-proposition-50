// ============================================================================
// MAP UTILITIES
// ============================================================================

import L from 'leaflet';
import { state } from './state.js';

// Utility: On mobile, bias the map's visual center to 33% from the top
export function applyMobileVerticalBias(): void {
  if (!state.map) return;
  const size = state.map.getSize();
  const desiredFractionFromTop = 0.33; // 33% down from top
  const deltaY = (0.5 - desiredFractionFromTop) * size.y; // positive means move up
  const isMobile = window.innerWidth <= 768;
  const extraPixels = isMobile ? 50 : 0; // only apply extra physical pan on mobile
  if (isMobile) {
    state.map.panBy(L.point(0, -(deltaY + extraPixels)), { animate: false });
  }
}

// Utility: On desktop, apply a simple default upward bias
export function applyDesktopDefaultBiasIfNeeded(): void {
  if (!state.map) return;
  const isMobile = window.innerWidth <= 768;
  if (isMobile) return; // desktop only
  const DEFAULT_DESKTOP_BIAS_PX = 200; // shift up by 200px by default
  state.map.panBy(L.point(0, -DEFAULT_DESKTOP_BIAS_PX), { animate: false });
}

