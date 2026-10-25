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

  // Refs for services
  const signalingRef = useRef(null);
  const webrtcRef = useRef(null);
  const streamerRef = useRef(null);
  const receiverRef = useRef(null);

  // 1. Check URL parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const roomParam = params.get('room');

    if (roomParam) {
      setViewMode('RECEIVER');
      setRoomId(roomParam.toUpperCase());
      initReceiver(roomParam.toUpperCase());
    }

    return () => {
      cleanup();
    };
  }, []);

  const cleanup = () => {
    if (streamerRef.current) streamerRef.current.cancel();
    if (webrtcRef.current) webrtcRef.current.close();
    if (signalingRef.current) signalingRef.current.disconnect();
  };

  // ===================== SENDER FLOW =====================
  const handleFilesSelected = async (files) => {
    setSelectedFiles(files);
    setViewMode('SENDER_ACTIVE');
    setSenderTransferState('WAITING_PEER');

    const totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    const fileMeta = {
      totalFiles: files.length,
      totalBytes,
      sampleName: files[0]?.name
    };

    // Initialize Signaling Client
    signalingRef.current = new SignalingClient({
      onRoomCreated: (code) => {
        setRoomId(code);
        const url = `${window.location.origin}/?room=${code}`;
        setShareUrl(url);
      },

      onPeerJoined: async () => {
        setSenderTransferState('CONNECTING');
        // Initialize WebRTC as initiator
        initSenderWebRTC();
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
    streamerRef.current = new FileStreamer(
      webrtcRef.current,
      selectedFiles,
      (progress) => {
        setTransferMetrics(progress);
      },
      () => {
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

    // Create Receiver parser
    receiverRef.current = new FileReceiver({
      onManifest: (manifest) => {
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
        setCompletedDownloads((prev) => [...prev, completedFile]);
      },
      onAllComplete: () => {
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

    // Create Signaling Client
    signalingRef.current = new SignalingClient({
      onRoomJoined: async (code, fileMeta) => {
        if (fileMeta) {
          setIncomingManifest({
            totalFiles: fileMeta.totalFiles,
            totalBytes: fileMeta.totalBytes
          });
        }
        initReceiverWebRTC();
      },

      onSignal: (signalData) => {
        if (webrtcRef.current) {
          webrtcRef.current.handleSignal(signalData);
        }
      },

      onPeerDisconnected: () => {
        if (receiverConnectionState !== 'COMPLETED') {
          setReceiverError('Sender closed their browser tab.');
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
            setReceiverError('Connection dropped.');
            setReceiverConnectionState('ERROR');
          }
        }
      }
    });

    await webrtcRef.current.init();
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
          <FileDropzone onFilesSelected={handleFilesSelected} />
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
