// Application Branding and Configuration
// Easily customize your brand name, colors, and slogans here!

export const APP_CONFIG = {
  name: 'BeamDrop',
  shortName: 'BeamDrop',
  domain: 'beamdrop.io',
  tagline: 'Direct, private peer-to-peer file sharing without size limits.',
  subtext: 'No cloud storage. No file size restrictions. Encrypted straight from device to device.',
  
  // Safe chunk size for 100% browser compatibility (desktop, Android, iOS Safari)
  defaultChunkSize: 32 * 1024, // 32 KB binary chunks to prevent SCTP header overflow
  bufferedThreshold: 512 * 1024, // 512 KB backpressure threshold
  
  // High-reliability STUN + TURN Relay servers (Cross-network NAT traversal)
  defaultIceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'stun:stun.cloudflare.com:3478' },
    {
      urls: [
        'turn:openrelay.metered.ca:80',
        'turn:openrelay.metered.ca:80?transport=tcp',
        'turn:openrelay.metered.ca:443',
        'turn:openrelay.metered.ca:443?transport=tcp'
      ],
      username: 'openrelayproject',
      credential: 'openrelayproject'
    }
  ]
};

export function getSignalingUrl() {
  if (import.meta.env.VITE_SIGNALING_URL) {
    return import.meta.env.VITE_SIGNALING_URL;
  }
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  if (import.meta.env.DEV) {
    return `ws://${window.location.hostname}:4000`;
  }
  
  return `${protocol}//${window.location.host}`;
}
