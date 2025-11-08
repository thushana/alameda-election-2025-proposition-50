// Global declaration for Leaflet loaded via script tag
import * as Leaflet from 'leaflet';

declare global {
  interface Window {
    L: typeof Leaflet;
  }
  const L: typeof Leaflet;
}

