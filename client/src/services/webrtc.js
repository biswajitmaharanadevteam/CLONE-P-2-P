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
  }

  async init(iceServers = APP_CONFIG.defaultIceServers) {
    this.peerConnection = new RTCPeerConnection({
      iceServers: iceServers && iceServers.length > 0 ? iceServers : APP_CONFIG.defaultIceServers
    });

    this.peerConnection.onicecandidate = (event) => {
      if (event.candidate && this.onSignal) {
        this.onSignal({
          candidate: event.candidate
        });
      }
    };

    this.peerConnection.onconnectionstatechange = () => {
      const state = this.peerConnection.connectionState;
      if (this.onStatusChange) {
        this.onStatusChange(state);
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
        this.dataChannel = event.channel;
        this.setupDataChannel(this.dataChannel);
      };
    }
  }

  setupDataChannel(channel) {
    channel.binaryType = 'arraybuffer';
    // Configure threshold for backpressure control
    channel.bufferedAmountLowThreshold = APP_CONFIG.bufferedThreshold;

    channel.onopen = () => {
      if (this.onChannelOpen) this.onChannelOpen();
    };

    channel.onclose = () => {
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
    const offer = await this.peerConnection.createOffer();
    await this.peerConnection.setLocalDescription(offer);
    if (this.onSignal) {
      this.onSignal({ sdp: this.peerConnection.localDescription });
    }
  }

  async handleSignal(signal) {
    if (!this.peerConnection) return;

    if (signal.sdp) {
      const desc = new RTCSessionDescription(signal.sdp);
      await this.peerConnection.setRemoteDescription(desc);
      this.hasRemoteDescription = true;

      // Drain queued ICE candidates
      while (this.iceCandidatesQueue.length > 0) {
        const cand = this.iceCandidatesQueue.shift();
        await this.peerConnection.addIceCandidate(cand);
      }

      if (desc.type === 'offer') {
        const answer = await this.peerConnection.createAnswer();
        await this.peerConnection.setLocalDescription(answer);
        if (this.onSignal) {
          this.onSignal({ sdp: this.peerConnection.localDescription });
        }
      }
    } else if (signal.candidate) {
      const candidate = new RTCIceCandidate(signal.candidate);
      if (this.hasRemoteDescription) {
        await this.peerConnection.addIceCandidate(candidate);
      } else {
        this.iceCandidatesQueue.push(candidate);
      }
    }
  }

  // Backpressure-aware chunk sender
  // Resolves when dataChannel buffer drops below threshold
  async sendChunk(data) {
    if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
      throw new Error('Data channel not open');
    }

    if (this.dataChannel.bufferedAmount > APP_CONFIG.bufferedThreshold) {
      await new Promise((resolve) => {
        const handleLowBuffer = () => {
          this.dataChannel.removeEventListener('bufferedamountlow', handleLowBuffer);
          resolve();
        };
        this.dataChannel.addEventListener('bufferedamountlow', handleLowBuffer);
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
