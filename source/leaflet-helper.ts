// Helper to access Leaflet from window (loaded via script tag)
export function getL(): typeof import('leaflet') {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet global API
  if (typeof window !== 'undefined' && (window as any).L) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Leaflet global API
    return (window as any).L;
  }
  throw new Error(
    'Leaflet is not loaded. Make sure the Leaflet script tag is loaded before the modules.'
  );
}
