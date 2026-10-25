import React, { useState, useRef } from 'react';
import { UploadCloud, FolderUp, File, X, ArrowRight, ShieldCheck, HardDrive } from 'lucide-react';
import { formatBytes, getFileCategory } from '../utils/formatters';

export default function FileDropzone({ onFilesSelected }) {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      appendFiles(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      appendFiles(Array.from(e.target.files));
    }
  };

  const appendFiles = (newFiles) => {
    setSelectedFiles((prev) => {
      const combined = [...prev];
      for (const nf of newFiles) {
        if (!combined.some((f) => f.name === nf.name && f.size === nf.size)) {
          combined.push(nf);
        }
      }
      return combined;
    });
  };

  const removeFile = (index) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const totalSize = selectedFiles.reduce((acc, f) => acc + f.size, 0);

  const handleStartTransfer = () => {
    if (selectedFiles.length > 0) {
      onFilesSelected(selectedFiles);
    }
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Dropzone Container */}
      <div
        onDragEnter={handleDrag}
        onDragOver={handleDrag}
        onDragLeave={handleDrag}
        onDrop={handleDrop}
        className={`relative rounded-3xl p-8 sm:p-12 transition-all duration-300 border-2 border-dashed ${
          dragActive
            ? 'border-cyan-400 bg-cyan-950/20 shadow-2xl shadow-cyan-500/10 scale-[1.01]'
            : 'border-slate-800 hover:border-slate-700 bg-slate-900/40 backdrop-blur-sm'
        }`}
      >
        {/* Hidden inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex flex-col items-center text-center">
          {/* Animated Upload Icon */}
          <div className="relative mb-6">
            <div className="w-20 h-20 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
              <UploadCloud className="w-10 h-10 group-hover:scale-110 transition-transform" />
            </div>
            <div className="absolute -inset-1 rounded-2xl bg-cyan-500/20 blur-xl -z-10 animate-pulse-glow" />
          </div>

          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-white mb-2">
            Drag & drop files to share
          </h2>
          <p className="text-slate-400 text-sm max-w-md mb-8">
            Directly from your device to the receiver. No size limits, no middleman server.
          </p>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-semibold text-sm shadow-lg shadow-cyan-500/25 transition duration-200 cursor-pointer"
            >
              Select Files
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-2 px-5 py-3 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 border border-slate-700 text-slate-200 font-medium text-sm transition duration-200 cursor-pointer"
            >
              <FolderUp className="w-4 h-4 text-cyan-400" />
              <span>Select Folder</span>
            </button>
          </div>
        </div>

        {/* Selected Files Queue */}
        {selectedFiles.length > 0 && (
          <div className="mt-8 pt-6 border-t border-slate-800">
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                Ready to transfer ({selectedFiles.length} {selectedFiles.length === 1 ? 'file' : 'files'})
              </span>
              <span className="text-xs font-mono font-medium text-cyan-400">
                {formatBytes(totalSize)} total
              </span>
            </div>

            <div className="max-h-52 overflow-y-auto space-y-2 pr-1">
              {selectedFiles.map((file, idx) => {
                const cat = getFileCategory(file.name);
                return (
                  <div
                    key={`${file.name}-${idx}`}
                    className="flex items-center justify-between p-2.5 rounded-xl bg-slate-950/60 border border-slate-800/80 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className={`p-2 rounded-lg border ${cat.color}`}>
                        <File className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200 truncate">{file.name}</p>
                        <p className="text-xs text-slate-500 font-mono">{formatBytes(file.size)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFile(idx)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition"
                      title="Remove file"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                );
              })}
            </div>

            {/* Launch Transfer Button */}
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={handleStartTransfer}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-8 py-3.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-sm shadow-xl shadow-cyan-500/25 transition duration-200 cursor-pointer"
              >
                <span>Generate Transfer Link</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Feature Micro-Badges */}
      <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
        <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/60">
          <HardDrive className="w-5 h-5 text-cyan-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-200">No Size Limits</h4>
          <p className="text-xs text-slate-500 mt-1">Send 100MB or 50GB+, directly between browsers.</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/60">
          <ShieldCheck className="w-5 h-5 text-emerald-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-200">100% Encrypted</h4>
          <p className="text-xs text-slate-500 mt-1">Direct DTLS P2P handshake. Nobody can intercept.</p>
        </div>
        <div className="p-4 rounded-2xl bg-slate-900/30 border border-slate-800/60">
          <UploadCloud className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
          <h4 className="text-sm font-semibold text-slate-200">Zero Cloud Storage</h4>
          <p className="text-xs text-slate-500 mt-1">Files are never stored on any server disk.</p>
        </div>
      </div>
    </div>
  );
}
