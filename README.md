# BeamDrop — Peer-to-Peer (P2P) File Sharing

> Direct, end-to-end encrypted file sharing without storage servers, file size caps, or speed throttle. 
> Built as a fully customizable, rebrandable alternative to services like ToffeeShare.

---

## ⚡ Key Features

- **Direct WebRTC P2P Streaming**: Files stream directly from browser to browser. **Zero cloud storage used**.
- **No File Size Limits**: Share 100MB, 10GB, or 100GB+ without running into server upload caps.
- **End-to-End Encrypted**: Native WebRTC DTLS/SRTP encryption protects all data in transit.
- **Backpressure & Memory Safety**: Streams in 64 KB binary chunks with `bufferedAmountLow` threshold tracking to prevent browser RAM exhaustion on huge files.
- **Dynamic QR Code & Share Link**: Instant mobile-to-desktop or phone-to-phone pairing with one-click URL copy and QR generation.
- **Real-Time Transfer Telemetry**: Live speed gauge (MB/s), ETA countdown, transferred byte counter, and progress bar.
- **Folder & Multi-File Support**: Select single files, multi-file batches, or entire directory trees.
- **Customizable Branding**: Easily customize the application name, domain, tagline, and color palette via `client/src/config/brand.js`.

---

## 📂 Project Structure

```text
CLONE-P-2-P/
├── client/                     # Frontend (React 19, Vite, Tailwind CSS)
│   ├── src/
│   │   ├── config/
│   │   │   └── brand.js        # Branding, app name, STUN defaults
│   │   ├── components/         # UI Components (Dropzone, Dashboard, Receiver, QR, FAQ)
│   │   ├── services/
│   │   │   ├── signaling.js    # WebSocket signaling client with auto-reconnect
│   │   │   ├── webrtc.js       # WebRTC connection & DataChannel lifecycle
│   │   │   ├── fileStreamer.js # Slicing, chunk streaming & backpressure
│   │   │   └── fileReceiver.js # Stream reassembly & automatic file saving
│   │   ├── utils/
│   │   │   └── formatters.js   # Byte formatting, speed, and time estimators
│   │   ├── App.jsx             # Main state coordinator
│   │   └── index.css           # Tailwind CSS
│   └── package.json
├── server/                     # Backend Signaling Server (Node.js + WebSockets)
│   ├── src/
│   │   └── server.js           # Lightweight room pairing & ICE candidate relay
│   ├── .env.example
│   └── package.json
└── package.json                # Root scripts
```

---

## 🚀 Running Locally

### 1. Start the Signaling Server
```bash
npm --prefix server run dev
# Server starts on http://localhost:4000 (WebSocket ws://localhost:4000)
```

### 2. Start the Frontend Client
In a second terminal window:
```bash
npm --prefix client run dev
# Frontend starts on http://localhost:3000
```

Open `http://localhost:3000` in your browser. Drag and drop any file to get a share link, then open that link in an Incognito window or on your phone to test the direct transfer!

---

## 🎨 Rebranding / Changing Names

To change the name from **BeamDrop** to whatever you want:
1. Open `client/src/config/brand.js`.
2. Update the `name`, `tagline`, and default configurations:
   ```javascript
   export const APP_CONFIG = {
     name: 'YourCustomName',
     tagline: 'Direct, private peer-to-peer file sharing.',
     // ...
   };
   ```
3. Update `<title>` in `client/index.html`.

---

## 🌐 Production Deployment Guide

### Option 1: Split Deployment (Recommended & 100% Free)
- **Frontend**: Deploy `client/` to **Vercel**, **Cloudflare Pages**, or **Netlify**.
  - Build command: `npm run build`
  - Output directory: `dist`
  - Environment variable: `VITE_SIGNALING_URL=wss://your-signaling-service.onrender.com`
- **Signaling Server**: Deploy `server/` to **Render.com**, **Fly.io**, or **Railway**.
  - Build command: `npm install`
  - Start command: `node src/server.js`

### Option 2: Single VPS (\$3.50/mo on Hetzner or DigitalOcean)
- Run `server/src/server.js` with `pm2`.
- Serve the built client files (`client/dist`) using Nginx or Caddy with automatic SSL certificates.
