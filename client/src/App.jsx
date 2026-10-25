import React, { useState, useEffect, useRef } from 'react';
import confetti from 'canvas-confetti';
import Navbar from './components/Navbar';
import FileDropzone from './components/FileDropzone';
import TransferDashboard from './components/TransferDashboard';
import ReceiverView from './components/ReceiverView';
import FAQSection from './components/FAQSection';
import Footer from './components/Footer';
import { SignalingClient } from './services/signaling';
import { WebRTCConnection } from './services/webrtc';
import { FileStreamer } from './services/fileStreamer';
import { FileReceiver } from './services/fileReceiver';
import { getSignalingUrl } from './config/brand';

export default function App() {
  // App View State: 'SENDER_IDLE' | 'SENDER_ACTIVE' | 'RECEIVER'
  const [viewMode, setViewMode] = useState('SENDER_IDLE');
  const [showFaq, setShowFaq] = useState(false);

  // Common State
  const [roomId, setRoomId] = useState(null);
  const [shareUrl, setShareUrl] = useState('');
  const [transferMetrics, setTransferMetrics] = useState({
    transferredBytes: 0,
    totalBytes: 0,
    percentage: 0,
    speed: 0,
    timeRemaining: null,
    fileName: ''
  });

  // Sender States
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [senderTransferState, setSenderTransferState] = useState('WAITING_PEER'); // 'WAITING_PEER' | 'CONNECTING' | 'TRANSFERRING' | 'COMPLETED' | 'CANCELLED' | 'DISCONNECTED'

  // Receiver States
  const [receiverConnectionState, setReceiverConnectionState] = useState('CONNECTING'); // 'CONNECTING' | 'WAITING_ACCEPT' | 'DOWNLOADING' | 'COMPLETED' | 'ERROR'
  const [incomingManifest, setIncomingManifest] = useState(null);
  const [completedDownloads, setCompletedDownloads] = useState([]);
  const [receiverError, setReceiverError] = useState('');

  // Refs for services & closure-safe file references
  const filesRef = useRef([]);
  const signalingRef = useRef(null);
  const webrtcRef = useRef(null);
  const streamerRef = useRef(null);
  const receiverRef = useRef(null);
  const signalQueueRef = useRef([]);

  // 1. Check URL parameters on mount & Ping Render wake-up
  useEffect(() => {
    wakeUpSignalingServer();

    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');

    if (roomParam) {
      const code = roomParam.trim().toUpperCase();
      setViewMode('RECEIVER');
      setRoomId(code);
      initReceiver(code);
    }

    return () => {
      cleanup();
    };
  }, []);

  const wakeUpSignalingServer = () => {
    try {
      const wsUrl = getSignalingUrl();
      const httpUrl = wsUrl.replace(/^ws/, 'http');
      fetch(`${httpUrl}/health`, { mode: 'cors' }).catch(() => {});
    } catch (e) {
      // Ignore background wake-up errors
    }
  };

  const cleanup = () => {
    if (streamerRef.current) streamerRef.current.cancel();
    if (webrtcRef.current) webrtcRef.current.close();
    if (signalingRef.current) signalingRef.current.disconnect();
    signalQueueRef.current = [];
  };

  // ===================== SENDER FLOW =====================
  const handleFilesSelected = async (files) => {
    if (!files || files.length === 0) return;

    // Store in Ref immediately to prevent stale React closures!
    filesRef.current = files;
    setSelectedFiles(files);
    setViewMode('SENDER_ACTIVE');
    setSenderTransferState('WAITING_PEER');

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const fileMeta = {
      totalFiles: files.length,
      totalBytes,
      sampleName: files[0]?.name
    };

    console.log('[Sender] Files selected:', files.length, 'Total size:', totalBytes);

    // Initialize Signaling Client
    signalingRef.current = new SignalingClient({
      onRoomCreated: (code) => {
        setRoomId(code);
        const url = `${window.location.origin}/?room=${code}`;
        setShareUrl(url);
      },

      onPeerJoined: async () => {
        console.log('[Sender] Peer joined, initiating WebRTC offer...');
        setSenderTransferState('CONNECTING');
        await initSenderWebRTC();
      },

      onSignal: (signalData) => {
        if (webrtcRef.current) {
          webrtcRef.current.handleSignal(signalData);
        }
      },

      onPeerDisconnected: () => {
        setSenderTransferState('DISCONNECTED');
      },

      onError: (err) => {
        console.warn('Sender signaling error:', err);
      }
    });

    await signalingRef.current.connect();
    signalingRef.current.createRoom(fileMeta);
  };

  const initSenderWebRTC = async () => {
    webrtcRef.current = new WebRTCConnection({
      isInitiator: true,
      onSignal: (data) => {
        signalingRef.current?.sendSignal(data);
      },
      onChannelOpen: () => {
        console.log('[Sender] DataChannel is OPEN. Starting stream...');
        setSenderTransferState('TRANSFERRING');
        startFileStreaming();
      },
      onChannelClose: () => {
        if (senderTransferState !== 'COMPLETED') {
          setSenderTransferState('DISCONNECTED');
        }
      },
      onStatusChange: (status) => {
        if (status === 'disconnected' || status === 'failed') {
          setSenderTransferState('DISCONNECTED');
        }
      }
    });

    await webrtcRef.current.init();
    await webrtcRef.current.createOffer();
  };

  const startFileStreaming = () => {
    // ALWAYS read from filesRef to guarantee fresh reference
    const filesToStream = filesRef.current && filesRef.current.length > 0 ? filesRef.current : selectedFiles;

    if (!filesToStream || filesToStream.length === 0) {
      console.error('[Sender] Cannot start stream: files list is empty!');
      return;
    }

    console.log('[Sender] Streaming files:', filesToStream.map(f => `${f.name} (${f.size} bytes)`));

    streamerRef.current = new FileStreamer(
      webrtcRef.current,
      filesToStream,
      (progress) => {
        setTransferMetrics(progress);
      },
      () => {
        console.log('[Sender] File transfer finished successfully!');
        setSenderTransferState('COMPLETED');
        confetti({
          particleCount: 100,
          spread: 70,
          origin: { y: 0.6 }
        });
      },
      (err) => {
        console.error('Streaming error:', err);
        setSenderTransferState('CANCELLED');
      }
    );

    streamerRef.current.start();
  };

  const handleSenderCancel = () => {
    cleanup();
    setSenderTransferState('CANCELLED');
  };

  const handleSenderReset = () => {
    cleanup();
    filesRef.current = [];
    setSelectedFiles([]);
    setRoomId(null);
    setShareUrl('');
    setTransferMetrics({
      transferredBytes: 0,
      totalBytes: 0,
      percentage: 0,
      speed: 0,
      timeRemaining: null,
      fileName: ''
    });
    setViewMode('SENDER_IDLE');
  };

  // ===================== RECEIVER FLOW =====================
  const initReceiver = async (targetRoomId) => {
    setReceiverConnectionState('CONNECTING');
    signalQueueRef.current = [];

    // 1. Create Receiver parser
    receiverRef.current = new FileReceiver({
      onManifest: (manifest) => {
        console.log('[Receiver] Setting manifest in state:', manifest);
        setIncomingManifest(manifest);
        setReceiverConnectionState('DOWNLOADING');
      },
      onFileStart: (fileMeta) => {
        setTransferMetrics((prev) => ({ ...prev, fileName: fileMeta.name }));
      },
      onProgress: (metrics) => {
        setTransferMetrics(metrics);
      },
      onFileReady: (completedFile) => {
        console.log('[Receiver] File ready:', completedFile.name);
        setCompletedDownloads((prev) => [...prev, completedFile]);
      },
      onAllComplete: () => {
        console.log('[Receiver] All files completed!');
        setReceiverConnectionState('COMPLETED');
        confetti({
          particleCount: 120,
          spread: 80,
          origin: { y: 0.6 }
        });
      },
      onCancel: () => {
        setReceiverError('The sender cancelled the transfer.');
        setReceiverConnectionState('ERROR');
      },
      onError: (err) => {
        setReceiverError(err?.message || 'Error occurred during transfer.');
        setReceiverConnectionState('ERROR');
      }
    });

    // 2. Pre-initialize WebRTC connection so it is ready before signals arrive
    await initReceiverWebRTC();

    // 3. Create Signaling Client
    signalingRef.current = new SignalingClient({
      onRoomJoined: (code, fileMeta) => {
        console.log('[Receiver] Room joined:', code);
        if (fileMeta) {
          setIncomingManifest({
            totalFiles: fileMeta.totalFiles,
            totalBytes: fileMeta.totalBytes
          });
        }
      },

      onSignal: async (signalData) => {
        if (webrtcRef.current && webrtcRef.current.isReady) {
          await webrtcRef.current.handleSignal(signalData);
        } else {
          signalQueueRef.current.push(signalData);
        }
      },

      onPeerDisconnected: () => {
        if (receiverConnectionState !== 'COMPLETED') {
          setReceiverError('Sender disconnected.');
          setReceiverConnectionState('ERROR');
        }
      },

      onError: (err) => {
        setReceiverError(err?.message || 'Room not found or expired.');
        setReceiverConnectionState('ERROR');
      }
    });

    await signalingRef.current.connect();
    signalingRef.current.joinRoom(targetRoomId);
  };

  const initReceiverWebRTC = async () => {
    webrtcRef.current = new WebRTCConnection({
      isInitiator: false,
      onSignal: (data) => {
        signalingRef.current?.sendSignal(data);
      },
      onChannelOpen: () => {
        console.log('[Receiver] DataChannel connected and opened!');
        setReceiverConnectionState('DOWNLOADING');
      },
      onDataReceived: (chunk) => {
        if (receiverRef.current) {
          receiverRef.current.handleData(chunk);
        }
      },
      onChannelClose: () => {
        if (receiverConnectionState !== 'COMPLETED') {
          setReceiverError('Direct peer connection closed.');
          setReceiverConnectionState('ERROR');
        }
      },
      onStatusChange: (status) => {
        if (status === 'failed' || status === 'disconnected') {
          if (receiverConnectionState !== 'COMPLETED') {
            setReceiverError('Direct connection could not be established.');
            setReceiverConnectionState('ERROR');
          }
        }
      }
    });

    await webrtcRef.current.init();

    // Drain queued signals if any arrived while initializing
    while (signalQueueRef.current.length > 0) {
      const sig = signalQueueRef.current.shift();
      await webrtcRef.current.handleSignal(sig);
    }
  };

  const handleManualJoin = (code) => {
    const cleanCode = code.trim().toUpperCase();
    if (cleanCode.length >= 4) {
      setViewMode('RECEIVER');
      setRoomId(cleanCode);
      initReceiver(cleanCode);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-950 text-slate-100 selection:bg-cyan-500 selection:text-white relative overflow-hidden">
      {/* Background Ambient Glows */}
      <div className="fixed top-0 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-gradient-to-b from-cyan-600/15 via-blue-600/10 to-transparent blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-0 right-10 w-[450px] h-[350px] bg-indigo-600/10 blur-3xl pointer-events-none -z-10" />

      {/* Navigation */}
      <Navbar onOpenFaq={() => setShowFaq(true)} />

      {/* Main Container */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-14 flex flex-col items-center justify-center">
        {/* SENDER: Idle Dropzone View */}
        {viewMode === 'SENDER_IDLE' && (
          <FileDropzone
            onFilesSelected={handleFilesSelected}
            onJoinRoom={handleManualJoin}
          />
        )}

        {/* SENDER: Active Transfer Dashboard */}
        {viewMode === 'SENDER_ACTIVE' && (
          <TransferDashboard
            files={selectedFiles}
            roomId={roomId}
            shareUrl={shareUrl}
            transferState={senderTransferState}
            metrics={transferMetrics}
            onCancel={handleSenderCancel}
            onReset={handleSenderReset}
          />
        )}

        {/* RECEIVER: Download View */}
        {viewMode === 'RECEIVER' && (
          <ReceiverView
            roomId={roomId}
            connectionState={receiverConnectionState}
            manifest={incomingManifest}
            metrics={transferMetrics}
            completedFiles={completedDownloads}
            errorMessage={receiverError}
            onAcceptTransfer={() => {}}
            onCancel={cleanup}
          />
        )}
      </main>

      {/* FAQ Modal */}
      {showFaq && <FAQSection onClose={() => setShowFaq(false)} />}

      {/* Footer */}
      <Footer />
    </div>
  );
}
