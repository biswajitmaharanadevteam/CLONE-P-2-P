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
    
    // Sub-blob chunking prevents JS heap exhaustion on huge files (e.g. 1.6GB+)
    this.currentBlobs = [];
    this.pendingChunks = [];
    this.pendingBytes = 0;

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
            console.log('[FileReceiver] Received MANIFEST:', msg);
            this.manifest = msg;
            this.totalReceivedBytes = 0;
            this.completedFiles = [];
            this.startTime = performance.now();
            this.lastUpdateTime = this.startTime;
            this.lastReceivedBytes = 0;
            if (this.onManifest) this.onManifest(msg);
            break;

          case 'FILE_START':
            console.log('[FileReceiver] Starting file:', msg.name, msg.size);
            this.currentFileIndex = msg.index;
            this.currentFileMeta = msg;
            this.currentBlobs = [];
            this.pendingChunks = [];
            this.pendingBytes = 0;
            this.receivedBytesCurrentFile = 0;
            if (this.onFileStart) this.onFileStart(msg);
            break;

          case 'FILE_END':
            console.log('[FileReceiver] Completed file receiving:', this.currentFileMeta?.name);
            this.finishCurrentFile();
            break;

          case 'ALL_COMPLETE':
            console.log('[FileReceiver] All files transfer complete');
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
        this.pendingChunks.push(data);
        this.pendingBytes += data.byteLength;
        this.receivedBytesCurrentFile += data.byteLength;
        this.totalReceivedBytes += data.byteLength;

        // Pack every 8MB of ArrayBuffers into a Blob to keep JS heap light
        if (this.pendingBytes >= 8 * 1024 * 1024) {
          this.currentBlobs.push(new Blob(this.pendingChunks));
          this.pendingChunks = [];
          this.pendingBytes = 0;
        }

        this.calculateMetrics();
      }
    } catch (err) {
      console.error('[FileReceiver] Error processing chunk:', err);
      if (this.onError) this.onError(err);
    }
  }

  finishCurrentFile() {
    if (!this.currentFileMeta) return;

    // Flush any remaining pending chunks into final blob
    if (this.pendingChunks.length > 0) {
      this.currentBlobs.push(new Blob(this.pendingChunks));
      this.pendingChunks = [];
      this.pendingBytes = 0;
    }

    const mime = this.currentFileMeta.mimeType || 'application/octet-stream';
    const finalBlob = new Blob(this.currentBlobs, { type: mime });
    const url = URL.createObjectURL(finalBlob);

    const completed = {
      name: this.currentFileMeta.name,
      size: this.currentFileMeta.size,
      mimeType: mime,
      blob: finalBlob,
      url
    };

    this.completedFiles.push(completed);

    // Auto-trigger browser download
    this.triggerDownload(completed);

    if (this.onFileReady) {
      this.onFileReady(completed);
    }

    // Clean up memory buffer for current file
    this.currentBlobs = [];
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
      console.warn('Auto download blocked by browser, user can use Save button', err);
    }
  }

  calculateMetrics() {
    const now = performance.now();
    const deltaMs = now - this.lastUpdateTime;

    if (deltaMs >= 250 || (this.manifest && this.totalReceivedBytes >= this.manifest.totalBytes)) {
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
