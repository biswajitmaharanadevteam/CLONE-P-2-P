import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { APP_CONFIG } from '../config/brand';

export default function Footer() {
  return (
    <footer className="w-full border-t border-slate-900 bg-slate-950 py-8 px-4 text-center text-xs text-slate-500">
      <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-cyan-400" />
          <span>{APP_CONFIG.name} — Zero server logs. Zero intermediate file storage.</span>
        </div>
        <div className="flex items-center gap-1">
          <span>Built with WebRTC & DTLS Encryption</span>
        </div>
      </div>
    </footer>
  );
}
