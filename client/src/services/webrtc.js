import { APP_CONFIG } from '../config/brand';

export class WebRTCConnection {
  constructor({ isInitiator, onSignal, onChannelOpen, onChannelClose, onDataReceived, onStatusChange }) {
    this.isInitiator = isInitiator;
    this.onSignal = onSignal;
    this.onChannelOpen = onChannelOpen;
    this.onChannelClose = onChannelClose;
    this.onDataReceived = onDataReceived;
    this.onStatusChange = onStatusChange;

    this.peerConnection = null;
    this.dataChannel = null;
    this.iceCandidatesQueue = [];
    this.hasRemoteDescription = false;
    this.isReady = false;
  }

  async init(iceServers = APP_CONFIG.defaultIceServers) {
    const config = {
      iceServers: iceServers && iceServers.length > 0 ? iceServers : APP_CONFIG.defaultIceServers,
      iceCandidatePoolSize: 2
    };

    this.peerConnection = new RTCPeerConnection(config);

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && event.candidate.candidate && this.onSignal) {
        this.onSignal({
          candidate: event.candidate.toJSON ? event.candidate.toJSON() : event.candidate
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection?.connectionState;
      console.log('[WebRTC] Connection state:', state);
      if (this.onStatusChange && state) {
        this.onStatusChange(state);
      }
    };

    this.peerConnection.oniceconnectionstatechange = () => {
      const iceState = this.peerConnection?.iceConnectionState;
      console.log('[WebRTC] ICE state:', iceState);
      if (iceState === 'failed') {
        // Attempt ICE restart if initiator
        if (this.isInitiator && this.peerConnection?.restartIce) {
          console.log('[WebRTC] Attempting ICE restart...');
          this.peerConnection.restartIce();
        }
      }
    };

    if (this.isInitiator) {
      // Sender creates the DataChannel
      this.dataChannel = this.peerConnection.createDataChannel('fileTransferChannel', {
        ordered: true
      });
      this.setupDataChannel(this.dataChannel);
    } else {
      // Receiver waits for the DataChannel
      this.peerConnection.ondatachannel = (event) => {
        console.log('[WebRTC] Data channel received by peer');
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };
    }

    this.isReady = true;
  }

  setupDataChannel(channel) {
    channel.binaryType = 'arraybuffer';
    channel.bufferedAmountLowThreshold = APP_CONFIG.bufferedThreshold;

    channel.onopen = () => {
      console.log('[WebRTC] DataChannel OPENED and ready for transfer');
      if (this.onChannelOpen) this.onChannelOpen();
    };

    channel.onclose = () => {
      console.log('[WebRTC] DataChannel CLOSED');
      if (this.onChannelClose) this.onChannelClose();
    };

    channel.onmessage = (event) => {
      if (this.onDataReceived) {
        this.onDataReceived(event.data);
      }
    };

    channel.onerror = (err) => {
      console.error('[WebRTC DataChannel Error]:', err);
    };
  }

  async createOffer() {
    if (!this.peerConnection) return;
    try {
      const offer = await this.peerConnection.createOffer();
      await this.peerConnection.setLocalDescription(offer);
      if (this.onSignal) {
        this.onSignal({ sdp: this.peerConnection.localDescription });
      }
    } catch (err) {
      console.error('[WebRTC] Create offer failed:', err);
    }
  }

  async handleSignal(signal) {
    if (!this.peerConnection) return;

    try {
      if (signal.sdp) {
        const desc = new RTCSessionDescription(signal.sdp);
        await this.peerConnection.setRemoteDescription(desc);
        this.hasRemoteDescription = true;

        // Drain any ICE candidates that arrived before remote description
        while (this.iceCandidatesQueue.length > 0) {
          const cand = this.iceCandidatesQueue.shift();
          try {
            await this.peerConnection.addIceCandidate(cand);
          } catch (e) {
            console.warn('[WebRTC] Error adding queued ICE candidate:', e);
          }
        }

        if (desc.type === 'offer') {
          const answer = await this.peerConnection.createAnswer();
          await this.peerConnection.setLocalDescription(answer);
          if (this.onSignal) {
            this.onSignal({ sdp: this.peerConnection.localDescription });
          }
        }
      } else if (signal.candidate) {
        if (!signal.candidate.candidate && signal.candidate.candidate !== '') {
          return; // Ignore null / invalid candidates
        }
        const candidate = new RTCIceCandidate(signal.candidate);
        if (this.hasRemoteDescription) {
          await this.peerConnection.addIceCandidate(candidate);
        } else {
          this.iceCandidatesQueue.push(candidate);
        }
      }
    } catch (err) {
      console.error('[WebRTC] Error in handleSignal:', err);
    }
  }

  // Backpressure-safe chunk sender with fail-safe poller
  async sendChunk(data) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    if (this.dataChannel.bufferedAmount > APP_CONFIG.bufferedThreshold) {
      await new Promise((resolve) => {
        let timer = null;
        const handleLowBuffer = () => {
          if (timer) clearInterval(timer);
          this.dataChannel?.removeEventListener('bufferedamountlow', handleLowBuffer);
          resolve();
        };

        this.dataChannel.addEventListener('bufferedamountlow', handleLowBuffer);

        // Fail-safe poller every 20ms in case the event fired before listener attached
        timer = setInterval(() => {
          if (!this.dataChannel || this.dataChannel.bufferedAmount <= APP_CONFIG.bufferedThreshold / 2) {
            handleLowBuffer();
          }
        }, 20);
      });
    }

    this.dataChannel.send(data);
  }

  sendControlMessage(msgObj) {
    if (this.dataChannel && this.dataChannel.readyState === 'open') {
      this.dataChannel.send(JSON.stringify(msgObj));
    }
  }

  close() {
    this.isReady = false;
    if (this.dataChannel) {
      try {
        this.dataChannel.close();
      } catch (e) {
        console.warn('Error closing dataChannel', e);
      }
      this.dataChannel = null;
    }
    if (this.peerConnection) {
      try {
        this.peerConnection.close();
      } catch (e) {
        console.warn('Error closing peerConnection', e);
      }
      this.peerConnection = null;
    }
  }
}
