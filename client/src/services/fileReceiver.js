export class FileReceiver {
  constructor({ onManifest, onFileStart, onProgress, onFileReady, onAllComplete, onCancel, onError }) {
    this.onManifest = onManifest;
    this.onFileStart = onFileStart;
    this.onProgress = onProgress;
    this.onFileReady = onFileReady;
    this.onAllComplete = onAllComplete;
    this.onCancel = onCancel;
    this.onError = onError;

    this.manifest = null;
    this.currentFileIndex = -1;
    this.currentFileMeta = null;
    this.currentChunks = [];
    this.receivedBytesCurrentFile = 0;
    this.totalReceivedBytes = 0;
    this.completedFiles = [];

    this.startTime = null;
    this.lastUpdateTime = null;
    this.lastReceivedBytes = 0;
    this.currentSpeed = 0;
  }

  handleData(data) {
    try {
      // 1. Control message (String)
      if (typeof data === 'string') {
        const msg = JSON.parse(data);

        switch (msg.type) {
          case 'MANIFEST':
            this.manifest = msg;
            this.totalReceivedBytes = 0;
            this.completedFiles = [];
            this.startTime = performance.now();
            this.lastUpdateTime = this.startTime;
            this.lastReceivedBytes = 0;
            if (this.onManifest) this.onManifest(msg);
            break;

          case 'FILE_START':
            this.currentFileIndex = msg.index;
            this.currentFileMeta = msg;
            this.currentChunks = [];
            this.receivedBytesCurrentFile = 0;
            if (this.onFileStart) this.onFileStart(msg);
            break;

          case 'FILE_END':
            this.finishCurrentFile();
            break;

          case 'ALL_COMPLETE':
            if (this.onAllComplete) this.onAllComplete(this.completedFiles);
            break;

          case 'TRANSFER_CANCELLED':
            if (this.onCancel) this.onCancel();
            break;

          default:
            break;
        }
        return;
      }

      // 2. Binary Chunk (ArrayBuffer)
      if (data instanceof ArrayBuffer) {
        this.currentChunks.push(data);
        this.receivedBytesCurrentFile += data.byteLength;
        this.totalReceivedBytes += data.byteLength;

        this.calculateMetrics();
      }
    } catch (err) {
      console.error('[FileReceiver] Error processing chunk:', err);
      if (this.onError) this.onError(err);
    }
  }

  finishCurrentFile() {
    if (!this.currentFileMeta) return;

    // Build Blob from received chunks
    const mime = this.currentFileMeta.mimeType || 'application/octet-stream';
    const blob = new Blob(this.currentChunks, { type: mime });
    const url = URL.createObjectURL(blob);

    const completed = {
      name: this.currentFileMeta.name,
      size: this.currentFileMeta.size,
      mimeType: mime,
      blob,
      url
    };

    this.completedFiles.push(completed);

    // Auto-trigger browser download
    this.triggerDownload(completed);

    if (this.onFileReady) {
      this.onFileReady(completed);
    }

    // Clean up memory buffer for current file
    this.currentChunks = [];
    this.currentFileMeta = null;
  }

  triggerDownload(file) {
    try {
      const a = document.createElement('a');
      a.href = file.url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err) {
      console.warn('Auto download failed, user can use download button', err);
    }
  }

  calculateMetrics() {
    const now = performance.now();
    const deltaMs = now - this.lastUpdateTime;

    if (deltaMs >= 250) {
      const bytesInInterval = this.totalReceivedBytes - this.lastReceivedBytes;
      const intervalSec = deltaMs / 1000;
      this.currentSpeed = intervalSec > 0 ? bytesInInterval / intervalSec : 0;

      const totalBytes = this.manifest ? this.manifest.totalBytes : 0;
      const remainingBytes = Math.max(0, totalBytes - this.totalReceivedBytes);
      const timeRemaining = this.currentSpeed > 0 ? remainingBytes / this.currentSpeed : null;
      const percentage = totalBytes > 0 ? (this.totalReceivedBytes / totalBytes) * 100 : 0;

      this.lastUpdateTime = now;
      this.lastReceivedBytes = this.totalReceivedBytes;

      if (this.onProgress) {
        this.onProgress({
          transferredBytes: this.totalReceivedBytes,
          totalBytes,
          percentage: Math.min(100, percentage),
          speed: this.currentSpeed,
          timeRemaining,
          fileIndex: this.currentFileIndex,
          fileName: this.currentFileMeta?.name
        });
      }
    }
  }
}
