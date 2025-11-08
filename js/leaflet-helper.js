// Helper to access Leaflet from window (loaded via script tag)
export function getL() {
    if (typeof window !== 'undefined' && window.L) {
        return window.L;
    }
    throw new Error('Leaflet is not loaded. Make sure the Leaflet script tag is loaded before the modules.');
}
