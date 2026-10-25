import express from 'express';
import http from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// In-memory room store
// roomId -> { id, sender: ws, receiver: ws, fileMeta: null, createdAt: Date }
const rooms = new Map();

// Helper to generate friendly 6-digit room code
function generateRoomCode() {
  const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ'; // avoids confusing 0/O, 1/I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Health check and metrics
app.get('/health', (req, res) => {
  res.json({
    status: 'online',
    service: 'BeamDrop P2P Signaling Server',
    uptime: Math.floor(process.uptime()),
    activeRooms: rooms.size,
    timestamp: new Date().toISOString()
  });
});

// ICE Servers Configuration Endpoint
// Allows client to dynamically fetch STUN / TURN configs (customizable via ENV)
app.get('/api/ice-servers', (req, res) => {
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ];

  // If user configures custom TURN in ENV (e.g. from Metered.ca, Coturn, etc.)
  if (process.env.TURN_URL && process.env.TURN_USERNAME && process.env.TURN_CREDENTIAL) {
    iceServers.push({
      urls: process.env.TURN_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL
    });
  }

  res.json({ iceServers });
});

const server = http.createServer(app);
const wss = new WebSocketServer({ server });

function safeSend(ws, payload) {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

wss.on('connection', (ws) => {
  ws.isAlive = true;
  ws.currentRoomId = null;
  ws.role = null; // 'sender' | 'receiver'

  ws.on('pong', () => {
    ws.isAlive = true;
  });

  ws.on('message', (raw) => {
    try {
      const data = JSON.parse(raw.toString());
      const { type, roomId, payload } = data;

      switch (type) {
        case 'create_room': {
          let code = generateRoomCode();
          while (rooms.has(code)) {
            code = generateRoomCode();
          }

          ws.currentRoomId = code;
          ws.role = 'sender';

          rooms.set(code, {
            id: code,
            sender: ws,
            receiver: null,
            fileMeta: payload?.fileMeta || null,
            createdAt: Date.now()
          });

          safeSend(ws, {
            type: 'room_created',
            roomId: code
          });
          break;
        }

        case 'update_meta': {
          const room = rooms.get(roomId);
          if (room && room.sender === ws) {
            room.fileMeta = payload?.fileMeta;
            if (room.receiver) {
              safeSend(room.receiver, {
                type: 'file_meta',
                fileMeta: room.fileMeta
              });
            }
          }
          break;
        }

        case 'join_room': {
          const room = rooms.get(roomId?.toUpperCase());
          if (!room) {
            safeSend(ws, {
              type: 'error',
              code: 'ROOM_NOT_FOUND',
              message: 'Transfer room does not exist or has expired.'
            });
            return;
          }

          if (room.receiver && room.receiver.readyState === WebSocket.OPEN) {
            safeSend(ws, {
              type: 'error',
              code: 'ROOM_BUSY',
              message: 'A receiver has already joined this direct transfer.'
            });
            return;
          }

          ws.currentRoomId = room.id;
          ws.role = 'receiver';
          room.receiver = ws;

          // Notify receiver they joined and provide file info immediately if available
          safeSend(ws, {
            type: 'room_joined',
            roomId: room.id,
            fileMeta: room.fileMeta
          });

          // Notify sender to begin WebRTC offer
          safeSend(room.sender, {
            type: 'peer_joined',
            roomId: room.id
          });
          break;
        }

        // WebRTC Signaling Forwarding (SDP Offer, SDP Answer, ICE Candidates)
        case 'signal': {
          const room = rooms.get(ws.currentRoomId);
          if (!room) return;

          const target = ws.role === 'sender' ? room.receiver : room.sender;
          if (target) {
            safeSend(target, {
              type: 'signal',
              senderRole: ws.role,
              signalData: payload
            });
          }
          break;
        }

        case 'transfer_status': {
          const room = rooms.get(ws.currentRoomId);
          if (!room) return;
          const target = ws.role === 'sender' ? room.receiver : room.sender;
          if (target) {
            safeSend(target, {
              type: 'transfer_status',
              payload
            });
          }
          break;
        }

        default:
          break;
      }
    } catch (err) {
      console.error('Error handling message:', err);
    }
  });

  ws.on('close', () => {
    if (ws.currentRoomId && rooms.has(ws.currentRoomId)) {
      const room = rooms.get(ws.currentRoomId);
      if (ws.role === 'sender') {
        // Sender disconnected - notify receiver and close room
        if (room.receiver) {
          safeSend(room.receiver, {
            type: 'peer_disconnected',
            message: 'Sender closed the connection or browser tab.'
          });
        }
        rooms.delete(ws.currentRoomId);
      } else if (ws.role === 'receiver') {
        // Receiver disconnected - notify sender
        if (room.sender) {
          safeSend(room.sender, {
            type: 'peer_disconnected',
            message: 'Receiver disconnected.'
          });
        }
        room.receiver = null;
      }
    }
  });
});

// Periodic heartbeat to clean dead sockets
const heartbeatInterval = setInterval(() => {
  wss.clients.forEach((ws) => {
    if (!ws.isAlive) {
      return ws.terminate();
    }
    ws.isAlive = false;
    ws.ping();
  });
}, 30000);

// Cleanup stale rooms (> 6 hours old)
setInterval(() => {
  const now = Date.now();
  for (const [code, room] of rooms.entries()) {
    if (now - room.createdAt > 6 * 60 * 60 * 1000) {
      rooms.delete(code);
    }
  }
}, 60 * 60 * 1000);

wss.on('close', () => {
  clearInterval(heartbeatInterval);
});

server.listen(PORT, () => {
  console.log(`[BeamDrop Signaling] Server active on http://localhost:${PORT}`);
  console.log(`[BeamDrop Signaling] WebSocket listening on ws://localhost:${PORT}`);
});
