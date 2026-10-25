import React from 'react';
import { X, Shield, HardDrive, Wifi, Lock, Zap } from 'lucide-react';
import { APP_CONFIG } from '../config/brand';

export default function FAQSection({ onClose }) {
  const faqs = [
    {
      q: 'How does this direct peer-to-peer transfer work?',
      a: 'When you choose files to send, our lightweight signaling server connects your browser directly to the recipient using WebRTC. Once connected, your files stream directly between your devices over an encrypted tunnel. No file data ever touches our server.',
      icon: Wifi
    },
    {
      q: 'Is there a file size limit?',
      a: 'No! Because files are transferred directly between your devices without being uploaded to or stored on a server, there are no artificial file size limitations. You can send 100MB, 10GB, or even 100GB+ files.',
      icon: HardDrive
    },
    {
      q: 'Is the transfer secure and encrypted?',
      a: 'Yes, 100%. All transfers are protected by standard DTLS/SRTP encryption natively built into WebRTC. Even if someone intercepts the traffic, it cannot be read.',
      icon: Lock
    },
    {
      q: 'Why must both users keep their browser tabs open?',
      a: 'Since we never store your files in the cloud, your browser acts as the live server streaming the data chunks. If either user closes their tab before completion, the direct stream pauses or disconnects.',
      icon: Shield
    },
    {
      q: 'How fast is the transfer speed?',
      a: 'Speed is limited only by your and the recipient’s internet upload and download bandwidth. If both devices are on the same Wi-Fi network, transfers happen at blazing-fast local LAN speeds.',
      icon: Zap
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="relative w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl bg-slate-900 border border-slate-800 p-6 sm:p-8 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-2 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-white">How {APP_CONFIG.name} Works</h2>
          <p className="text-xs text-slate-400 mt-1">Frequently Asked Questions & Technology Overview</p>
        </div>

        <div className="space-y-4">
          {faqs.map((item, idx) => {
            const Icon = item.icon;
            return (
              <div key={idx} className="p-4 rounded-2xl bg-slate-950/60 border border-slate-800/80">
                <div className="flex items-center gap-2.5 text-slate-200 font-semibold text-sm mb-2">
                  <div className="p-1.5 rounded-lg bg-cyan-500/10 text-cyan-400">
                    <Icon className="w-4 h-4" />
                  </div>
                  <span>{item.q}</span>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed pl-8">{item.a}</p>
              </div>
            );
          })}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-800 text-center">
          <button
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs transition"
          >
            Got it, take me back
          </button>
        </div>
      </div>
    </div>
  );
}
