// Application Branding and Configuration
// Easily customize your brand name, colors, and slogans here!

export const APP_CONFIG = {
  name: 'BeamDrop',
  shortName: 'BeamDrop',
  domain: 'beamdrop.io',
  tagline: 'Direct, private peer-to-peer file sharing without size limits.',
  subtext: 'No cloud storage. No file size restrictions. Encrypted straight from device to device.',
  
  // Networking defaults
  defaultChunkSize: 64 * 1024, // 64 KB binary chunks for high throughput
  bufferedThreshold: 1024 * 1024, // 1 MB backpressure buffer limit
  
  // Fallback public STUN servers
  defaultIceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' }
  ]
};

export function getSignalingUrl() {
  if (import.meta.env.VITE_SIGNALING_URL) {
    return import.meta.env.VITE_SIGNALING_URL;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  // In development Vite proxy routes /ws to localhost:4000
  if (import.meta.env.DEV) {
    return `ws://${window.location.hostname}:4000`;
  }
  
  return `${protocol}//${window.location.host}`;
}
