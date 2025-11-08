// ============================================================================
// MAP UTILITIES
// ============================================================================

// Utility: On mobile, bias the map's visual center to 33% from the top
function applyMobileVerticalBias() {
    if (!map) return;
    var size = map.getSize();
    var desiredFractionFromTop = 0.33; // 33% down from top
    var deltaY = (0.5 - desiredFractionFromTop) * size.y; // positive means move up
    var isMobile = window.innerWidth <= 768;
    var extraPixels = isMobile ? 50 : 0; // only apply extra physical pan on mobile
    if (isMobile) {
        map.panBy([0, -(deltaY + extraPixels)], { animate: false });
    }
}

// Utility: On desktop, apply a simple default upward bias
function applyDesktopDefaultBiasIfNeeded() {
    if (!map) return;
    var isMobile = window.innerWidth <= 768;
    if (isMobile) return; // desktop only
    var DEFAULT_DESKTOP_BIAS_PX = 200; // shift up by 200px by default
    map.panBy([0, -DEFAULT_DESKTOP_BIAS_PX], { animate: false });
}

