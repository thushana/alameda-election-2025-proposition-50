// Helper to access Leaflet from window (loaded via script tag)
export function getL(): typeof import('leaflet') {
  if (typeof window !== 'undefined' && (window as any).L) {
    return (window as any).L;
  }
  throw new Error('Leaflet is not loaded. Make sure the Leaflet script tag is loaded before the modules.');
}

