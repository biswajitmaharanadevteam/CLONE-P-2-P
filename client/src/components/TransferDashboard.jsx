import React, { useState } from 'react';
import {
  Copy,
  Check,
  QrCode,
  Radio,
  FileCheck,
  Zap,
  Clock,
  Gauge,
  XCircle,
  File,
  AlertTriangle
} from 'lucide-react';
import QRCodeModal from './QRCodeModal';
import { formatBytes, formatSpeed, formatTimeRemaining, getFileCategory } from '../utils/formatters';

export default function TransferDashboard({
  files,
  roomId,
  shareUrl,
  transferState, // 'WAITING_PEER' | 'CONNECTING' | 'TRANSFERRING' | 'COMPLETED' | 'CANCELLED' | 'DISCONNECTED'
  metrics,
  onCancel,
  onReset
}) {
  const [copied, setCopied] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const totalSize = files.reduce((acc, f) => acc + f.size, 0);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {showQR && (
        <QRCodeModal
          url={shareUrl}
          roomId={roomId}
          onClose={() => setShowQR(false)}
        />
      )}

      <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        {/* Header Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-6 border-b border-slate-800 gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              {transferState === 'WAITING_PEER' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-ping" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-amber-400">
                    Waiting for receiver...
                  </span>
                </>
              )}
              {transferState === 'CONNECTING' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Establishing P2P Tunnel...
                  </span>
                </>
              )}
              {transferState === 'TRANSFERRING' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-cyan-400">
                    Direct P2P Streaming
                  </span>
                </>
              )}
              {transferState === 'COMPLETED' && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">
                    Transfer Complete!
                  </span>
                </>
              )}
              {(transferState === 'DISCONNECTED' || transferState === 'CANCELLED') && (
                <>
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-rose-400">
                    {transferState === 'CANCELLED' ? 'Transfer Cancelled' : 'Connection Closed'}
                  </span>
                </>
              )}
            </div>

            <h2 className="text-xl sm:text-2xl font-bold text-white">
              {files.length === 1 ? files[0].name : `${files.length} Files Ready`}
            </h2>
            <p className="text-xs font-mono text-slate-400 mt-0.5">
              {formatBytes(totalSize)} total
            </p>
          </div>

          {/* Room Code Badge */}
          <div className="flex items-center gap-2">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-right">
              <span className="block text-[10px] uppercase font-semibold text-slate-500">Room Code</span>
              <span className="text-sm font-mono font-bold tracking-widest text-cyan-400">{roomId}</span>
            </div>
            <button
              onClick={() => setShowQR(true)}
              className="p-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition cursor-pointer"
              title="Show QR Code"
            >
              <QrCode className="w-5 h-5 text-cyan-400" />
            </button>
          </div>
        </div>

        {/* Share Link Box */}
        <div className="my-6">
          <label className="block text-xs font-medium text-slate-400 mb-2">
            Share this link with the receiver:
          </label>
          <div className="flex items-center gap-2 p-1.5 rounded-2xl bg-slate-950 border border-slate-800 focus-within:border-cyan-500/50 transition">
            <input
              type="text"
              readOnly
              value={shareUrl}
              className="w-full bg-transparent px-3 text-xs sm:text-sm font-mono text-slate-200 outline-none truncate"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs transition cursor-pointer shrink-0"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-slate-950" />
                  <span>Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Link</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Transfer Progress and Metrics */}
        {(transferState === 'TRANSFERRING' || transferState === 'COMPLETED') && (
          <div className="space-y-4 my-6 p-4 rounded-2xl bg-slate-950/80 border border-slate-800/80">
            {/* Progress Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium">
                  {metrics.fileName ? `Streaming: ${metrics.fileName}` : 'Transfer Progress'}
                </span>
                <span className="font-mono font-bold text-cyan-400">
                  {Math.round(metrics.percentage || 0)}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden relative">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-200 rounded-full"
                  style={{ width: `${metrics.percentage || 0}%` }}
                />
              </div>
            </div>

            {/* Metrics Grid */}
            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Speed</span>
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-slate-200">
                  {formatSpeed(metrics.speed)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Sent</span>
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-slate-200 truncate">
                  {formatBytes(metrics.transferredBytes || 0)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="flex items-center gap-1.5 text-slate-500 text-[11px] mb-1">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>ETA</span>
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-slate-200 truncate">
                  {formatTimeRemaining(metrics.timeRemaining)}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab Reminder Notice */}
        {transferState === 'WAITING_PEER' && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs my-6">
            <Radio className="w-4 h-4 shrink-0 mt-0.5 animate-pulse" />
            <div>
              <span className="font-semibold">Keep this tab open!</span> Files are sent directly from your device. Transfer starts automatically as soon as the receiver opens the link.
            </div>
          </div>
        )}

        {transferState === 'DISCONNECTED' && (
          <div className="flex items-start gap-3 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs my-6">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Peer connection closed.</span> The receiver disconnected before the transfer could finish.
            </div>
          </div>
        )}

        {/* File Manifest List */}
        <div className="space-y-2 pt-2 border-t border-slate-800">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Files in this transfer
          </span>
          <div className="max-h-40 overflow-y-auto space-y-1.5 pr-1">
            {files.map((file, i) => {
              const cat = getFileCategory(file.name);
              return (
                <div
                  key={`${file.name}-${i}`}
                  className="flex items-center justify-between p-2 rounded-xl bg-slate-950/40 border border-slate-800/60 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <div className={`p-1.5 rounded-lg border ${cat.color}`}>
                      <File className="w-3.5 h-3.5" />
                    </div>
                    <span className="font-medium text-slate-300 truncate">{file.name}</span>
                  </div>
                  <span className="font-mono text-slate-500 shrink-0">{formatBytes(file.size)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Bottom Actions */}
        <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between">
          {transferState === 'COMPLETED' ? (
            <button
              onClick={onReset}
              className="w-full py-3 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-lg shadow-cyan-500/25 transition cursor-pointer"
            >
              Send Another File
            </button>
          ) : (
            <button
              onClick={onCancel}
              className="flex items-center gap-1.5 text-xs font-semibold text-rose-400 hover:text-rose-300 p-2 rounded-lg hover:bg-rose-500/10 transition cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              <span>Cancel Transfer</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
