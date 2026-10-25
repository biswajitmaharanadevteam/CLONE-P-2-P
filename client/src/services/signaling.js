import { getSignalingUrl } from '../config/brand';

export class SignalingClient {
  constructor(callbacks = {}) {
    this.url = getSignalingUrl();
    this.ws = null;
    this.callbacks = callbacks;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimer = null;
    this.isManualClose = false;
  }

  connect() {
    return new Promise((resolve, reject) => {
      this.isManualClose = false;
      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          this.reconnectAttempts = 0;
          if (this.callbacks.onConnected) this.callbacks.onConnected();
          resolve(true);
        };

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            this.handleMessage(data);
          } catch (err) {
            console.error('[Signaling] Failed to parse message:', err);
          }
        };

        this.ws.onerror = (err) => {
          console.warn('[Signaling] Socket error:', err);
          if (this.callbacks.onError) this.callbacks.onError(err);
        };

        this.ws.onclose = () => {
          if (this.callbacks.onDisconnected) this.callbacks.onDisconnected();
          if (!this.isManualClose && this.reconnectAttempts < this.maxReconnectAttempts) {
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 8000);
            this.reconnectAttempts++;
            this.reconnectTimer = setTimeout(() => this.connect(), delay);
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  handleMessage(data) {
    const { type, roomId, fileMeta, signalData, code, message, payload } = data;

    switch (type) {
      case 'room_created':
        if (this.callbacks.onRoomCreated) this.callbacks.onRoomCreated(roomId);
        break;
      case 'room_joined':
        if (this.callbacks.onRoomJoined) this.callbacks.onRoomJoined(roomId, fileMeta);
        break;
      case 'peer_joined':
        if (this.callbacks.onPeerJoined) this.callbacks.onPeerJoined(roomId);
        break;
      case 'signal':
        if (this.callbacks.onSignal) this.callbacks.onSignal(signalData);
        break;
      case 'file_meta':
        if (this.callbacks.onFileMeta) this.callbacks.onFileMeta(fileMeta);
        break;
      case 'transfer_status':
        if (this.callbacks.onTransferStatus) this.callbacks.onTransferStatus(payload);
        break;
      case 'peer_disconnected':
        if (this.callbacks.onPeerDisconnected) this.callbacks.onPeerDisconnected(message);
        break;
      case 'error':
        if (this.callbacks.onError) this.callbacks.onError({ code, message });
        break;
      default:
        break;
    }
  }

  send(type, payload = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, ...payload }));
    } else {
      console.warn('[Signaling] Cannot send, socket not open');
    }
  }

  createRoom(fileMeta) {
    this.send('create_room', { payload: { fileMeta } });
  }

  joinRoom(roomId) {
    this.send('join_room', { roomId });
  }

  updateMeta(roomId, fileMeta) {
    this.send('update_meta', { roomId, payload: { fileMeta } });
  }

  sendSignal(signalData) {
    this.send('signal', { payload: signalData });
  }

  sendTransferStatus(payload) {
    this.send('transfer_status', { payload });
  }

  disconnect() {
    this.isManualClose = true;
    clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
