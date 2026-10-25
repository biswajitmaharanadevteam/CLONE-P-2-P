import React from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { X, Smartphone, Copy, Check } from 'lucide-react';

export default function QRCodeModal({ url, roomId, onClose }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-sm rounded-3xl bg-slate-900 border border-slate-800 p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex flex-col items-center text-center">
          <div className="p-3 rounded-2xl bg-cyan-500/10 text-cyan-400 mb-3">
            <Smartphone className="w-6 h-6" />
          </div>
          <h3 className="text-lg font-bold text-white mb-1">Scan to Receive</h3>
          <p className="text-xs text-slate-400 mb-6 max-w-xs">
            Open camera on any smartphone or tablet to initiate direct peer-to-peer download.
          </p>

          {/* QR Code Container */}
          <div className="p-4 rounded-2xl bg-white shadow-xl mb-4">
            <QRCodeSVG
              value={url}
              size={200}
              level="H"
              includeMargin={false}
            />
          </div>

          <div className="text-xs font-mono text-slate-400 mb-4">
            Room Code: <span className="font-bold text-cyan-400 tracking-wider">{roomId}</span>
          </div>

          <button
            onClick={handleCopy}
            className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition"
          >
            {copied ? (
              <>
                <Check className="w-4 h-4 text-emerald-400" />
                <span className="text-emerald-400">Link Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-4 h-4" />
                <span>Copy Share Link</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
