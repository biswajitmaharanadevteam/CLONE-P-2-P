import { APP_CONFIG } from '../config/brand';

export class FileStreamer {
  constructor(webrtcConnection, files = [], onProgress, onComplete, onError) {
    this.connection = webrtcConnection;
    this.files = files;
    this.onProgress = onProgress;
    this.onComplete = onComplete;
    this.onError = onError;

    this.isCancelled = false;
    this.chunkSize = APP_CONFIG.defaultChunkSize; // 64KB
    this.totalBytes = files.reduce((acc, f) => acc + f.size, 0);
    this.transferredBytes = 0;
    this.startTime = null;
    this.lastUpdateTime = null;
    this.lastTransferredBytes = 0;
    this.currentSpeed = 0;
  }

  cancel() {
    this.isCancelled = true;
    try {
      this.connection.sendControlMessage({ type: 'TRANSFER_CANCELLED' });
    } catch (e) {
      console.warn(e);
    }
  }

  async start() {
    this.isCancelled = false;
    this.transferredBytes = 0;
    this.startTime = performance.now();
    this.lastUpdateTime = this.startTime;
    this.lastTransferredBytes = 0;

    try {
      // 1. Send manifest of all files to receiver
      const manifest = {
        type: 'MANIFEST',
        totalFiles: this.files.length,
        totalBytes: this.totalBytes,
        files: this.files.map((f, index) => ({
          index,
          name: f.name,
          size: f.size,
          type: f.type || 'application/octet-stream',
          lastModified: f.lastModified
        }))
      };

      this.connection.sendControlMessage(manifest);

      // Brief delay to let receiver initialize buffer/streams
      await new Promise((r) => setTimeout(r, 200));

      // 2. Stream files sequentially
      for (let i = 0; i < this.files.length; i++) {
        if (this.isCancelled) return;
        const file = this.files[i];

        // Signal file start
        this.connection.sendControlMessage({
          type: 'FILE_START',
          index: i,
          name: file.name,
          size: file.size,
          mimeType: file.type || 'application/octet-stream',
          totalChunks: Math.ceil(file.size / this.chunkSize)
        });

        await this.streamSingleFile(file, i);

        // Signal file complete
        this.connection.sendControlMessage({
          type: 'FILE_END',
          index: i
        });
      }

      if (!this.isCancelled) {
        this.connection.sendControlMessage({ type: 'ALL_COMPLETE' });
        if (this.onComplete) this.onComplete();
      }
    } catch (err) {
      console.error('[FileStreamer] Streaming failed:', err);
      if (this.onError) this.onError(err);
    }
  }

  async streamSingleFile(file, fileIndex) {
    let offset = 0;

    while (offset < file.size) {
      if (this.isCancelled) break;

      const slice = file.slice(offset, offset + this.chunkSize);
      const buffer = await slice.arrayBuffer();

      await this.connection.sendChunk(buffer);

      offset += buffer.byteLength;
      this.transferredBytes += buffer.byteLength;

      this.calculateMetrics(fileIndex);
    }
  }

  calculateMetrics(fileIndex) {
    const now = performance.now();
    const deltaMs = now - this.lastUpdateTime;

    // Update speed calculation every 250ms
    if (deltaMs >= 250 || this.transferredBytes === this.totalBytes) {
      const bytesInInterval = this.transferredBytes - this.lastTransferredBytes;
      const intervalSec = deltaMs / 1000;
      this.currentSpeed = intervalSec > 0 ? bytesInInterval / intervalSec : 0;

      const remainingBytes = Math.max(0, this.totalBytes - this.transferredBytes);
      const timeRemaining = this.currentSpeed > 0 ? remainingBytes / this.currentSpeed : null;
      const progressPercent = this.totalBytes > 0 ? (this.transferredBytes / this.totalBytes) * 100 : 0;

      this.lastUpdateTime = now;
      this.lastTransferredBytes = this.transferredBytes;

      if (this.onProgress) {
        this.onProgress({
          transferredBytes: this.transferredBytes,
          totalBytes: this.totalBytes,
          percentage: Math.min(100, progressPercent),
          speed: this.currentSpeed,
          timeRemaining,
          fileIndex,
          fileName: this.files[fileIndex]?.name
        });
      }
    }
  }
}
