import React from 'react';
import {
  DownloadCloud,
  FileCheck,
  Zap,
  Clock,
  Gauge,
  AlertCircle,
  File,
  CheckCircle2,
  Download
} from 'lucide-react';
import { formatBytes, formatSpeed, formatTimeRemaining, getFileCategory } from '../utils/formatters';

export default function ReceiverView({
  roomId,
  connectionState, // 'CONNECTING' | 'WAITING_ACCEPT' | 'DOWNLOADING' | 'COMPLETED' | 'ERROR'
  manifest,
  metrics,
  completedFiles,
  errorMessage,
  onAcceptTransfer,
  onCancel
}) {
  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="rounded-3xl bg-slate-900/60 border border-slate-800 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        {/* Header */}
        <div className="text-center pb-6 border-b border-slate-800">
          <div className="inline-flex p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-3 border border-cyan-500/20">
            {connectionState === 'COMPLETED' ? (
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            ) : (
              <DownloadCloud className="w-8 h-8" />
            )}
          </div>

          <h2 className="text-2xl font-bold text-white">
            {connectionState === 'COMPLETED'
              ? 'Download Complete!'
              : connectionState === 'DOWNLOADING'
              ? 'Receiving Files...'
              : 'Incoming Direct P2P File Transfer'}
          </h2>

          <p className="text-xs text-slate-400 mt-1">
            Room Code: <span className="font-mono font-bold text-cyan-400">{roomId}</span>
          </p>
        </div>

        {/* Error State */}
        {connectionState === 'ERROR' && (
          <div className="my-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-300 text-xs flex items-start gap-3">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold text-sm">Connection Failed</p>
              <p className="mt-1 text-slate-400">{errorMessage || 'The sender may have closed the transfer room or went offline.'}</p>
              <button
                onClick={() => window.location.href = '/'}
                className="mt-3 px-4 py-1.5 rounded-lg bg-slate-800 text-white font-medium hover:bg-slate-700 transition"
              >
                Go to Home
              </button>
            </div>
          </div>
        )}

        {/* Manifest Preview */}
        {manifest && (
          <div className="my-6">
            <div className="flex items-center justify-between mb-3 text-xs">
              <span className="font-semibold uppercase tracking-wider text-slate-400">
                Incoming Files ({manifest.totalFiles})
              </span>
              <span className="font-mono font-bold text-cyan-400">
                {formatBytes(manifest.totalBytes)} total
              </span>
            </div>

            <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {manifest.files?.map((f, i) => {
                const cat = getFileCategory(f.name);
                const isDownloaded = completedFiles?.some((cf) => cf.name === f.name);

                return (
                  <div
                    key={`${f.name}-${i}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 text-xs"
                  >
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className={`p-1.5 rounded-lg border ${cat.color}`}>
                        <File className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-slate-200 truncate">{f.name}</p>
                        <p className="text-[11px] text-slate-500 font-mono">{formatBytes(f.size)}</p>
                      </div>
                    </div>

                    {isDownloaded && (
                      <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-md shrink-0">
                        <CheckCircle2 className="w-3 h-3" />
                        Saved
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Live Progress & Gauges */}
        {(connectionState === 'DOWNLOADING' || connectionState === 'COMPLETED') && (
          <div className="my-6 p-4 rounded-2xl bg-slate-950/80 border border-slate-800 space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400 font-medium truncate pr-2">
                  {metrics.fileName ? `Saving: ${metrics.fileName}` : 'Receiving Stream...'}
                </span>
                <span className="font-mono font-bold text-cyan-400">
                  {Math.round(metrics.percentage || 0)}%
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-slate-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-indigo-500 rounded-full transition-all duration-200"
                  style={{ width: `${metrics.percentage || 0}%` }}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 pt-2">
              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="flex items-center gap-1 text-slate-500 text-[11px] mb-1">
                  <Gauge className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Speed</span>
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-slate-200">
                  {formatSpeed(metrics.speed)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="flex items-center gap-1 text-slate-500 text-[11px] mb-1">
                  <Zap className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Received</span>
                </div>
                <div className="text-xs sm:text-sm font-mono font-bold text-slate-200 truncate">
                  {formatBytes(metrics.transferredBytes || 0)}
                </div>
              </div>

              <div className="p-2.5 rounded-xl bg-slate-900/60 border border-slate-800/60">
                <div className="flex items-center gap-1 text-slate-500 text-[11px] mb-1">
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

        {/* Completed Downloads List */}
        {completedFiles && completedFiles.length > 0 && (
          <div className="my-6 space-y-2">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Downloaded Files
            </h4>
            <div className="space-y-2">
              {completedFiles.map((file, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 text-xs"
                >
                  <div className="flex items-center gap-2 min-w-0 pr-2">
                    <FileCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                    <span className="font-medium text-slate-200 truncate">{file.name}</span>
                  </div>
                  <a
                    href={file.url}
                    download={file.name}
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold transition shrink-0"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download</span>
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6 pt-4 border-t border-slate-800">
          {connectionState === 'WAITING_ACCEPT' && (
            <button
              onClick={onAcceptTransfer}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-bold text-sm shadow-xl shadow-cyan-500/25 transition cursor-pointer"
            >
              <DownloadCloud className="w-5 h-5" />
              <span>Start Direct P2P Download</span>
            </button>
          )}

          {connectionState === 'CONNECTING' && (
            <div className="text-center py-2 text-xs font-medium text-cyan-400 animate-pulse">
              Connecting to sender's device...
            </div>
          )}

          {connectionState === 'COMPLETED' && (
            <button
              onClick={() => window.location.href = '/'}
              className="w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition cursor-pointer"
            >
              Transfer Complete — Send Your Own Files
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
