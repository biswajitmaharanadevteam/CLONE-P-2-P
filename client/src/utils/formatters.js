export function formatBytes(bytes, decimals = 1) {
  if (!+bytes) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export function formatSpeed(bytesPerSec) {
  if (!bytesPerSec || bytesPerSec <= 0) return '0 KB/s';
  return `${formatBytes(bytesPerSec)}/s`;
}

export function formatTimeRemaining(seconds) {
  if (!isFinite(seconds) || seconds < 0 || seconds == null) return 'Calculating...';
  if (seconds < 1) return 'Almost done...';
  if (seconds < 60) return `${Math.ceil(seconds)}s remaining`;
  
  const mins = Math.floor(seconds / 60);
  const remainingSecs = Math.floor(seconds % 60);
  if (mins < 60) {
    return `${mins}m ${remainingSecs}s remaining`;
  }
  
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hours}h ${remMins}m remaining`;
}

export function getFileCategory(filename = '') {
  const ext = filename.split('.').pop()?.toLowerCase();
  
  if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'avif'].includes(ext)) {
    return { type: 'image', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' };
  }
  if (['mp4', 'mkv', 'avi', 'mov', 'webm'].includes(ext)) {
    return { type: 'video', color: 'text-rose-400 bg-rose-400/10 border-rose-400/20' };
  }
  if (['mp3', 'wav', 'flac', 'aac', 'ogg'].includes(ext)) {
    return { type: 'audio', color: 'text-emerald-400 bg-emerald-400/10 border-emerald-400/20' };
  }
  if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) {
    return { type: 'archive', color: 'text-purple-400 bg-purple-400/10 border-purple-400/20' };
  }
  if (['pdf', 'doc', 'docx', 'txt', 'md', 'epub'].includes(ext)) {
    return { type: 'document', color: 'text-sky-400 bg-sky-400/10 border-sky-400/20' };
  }
  if (['js', 'ts', 'jsx', 'tsx', 'html', 'css', 'json', 'py', 'go', 'rs'].includes(ext)) {
    return { type: 'code', color: 'text-indigo-400 bg-indigo-400/10 border-indigo-400/20' };
  }
  
  return { type: 'file', color: 'text-slate-400 bg-slate-400/10 border-slate-400/20' };
}
