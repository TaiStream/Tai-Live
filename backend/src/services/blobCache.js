const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const { createWriteStream } = require('fs');
const { Readable } = require('stream');

// Use dynamic import for node-fetch or fallback to global fetch if available
// For this environment, we'll assume Node 18+ has global fetch, or we use a simple http/https module wrapper if needed.
// But mostly standard fetch is available.

const CACHE_DIR = path.join(__dirname, '../../data/cache');
const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';

if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

class BlobCache {
    constructor() {
        this.activeDownloads = new Map(); // blobId -> Promise
    }

    getFilePath(blobId) {
        return path.join(CACHE_DIR, blobId);
    }

    /**
     * Ensures the blob is cached.
     * If cached, returns path immediately.
     * If caching, waits for cache to finish (simple version) or returns stream (complex).
     * For MVP High-fidelity Range support: We download to disk first if missing. 
     * (Simultaneous stream + write is complex for Ranges).
     */
    async ensureCached(blobId) {
        const filePath = this.getFilePath(blobId);

        if (fs.existsSync(filePath)) {
            // Check if it's fully downloaded? 
            // For prototype, assume existence = full file. 
            // In prod, use .temp extension while downloading.
            return filePath;
        }

        if (this.activeDownloads.has(blobId)) {
            await this.activeDownloads.get(blobId);
            return filePath;
        }

        // Start download
        const downloadPromise = this._downloadFromWalrus(blobId, filePath);
        this.activeDownloads.set(blobId, downloadPromise);

        try {
            await downloadPromise;
            return filePath;
        } finally {
            this.activeDownloads.delete(blobId);
        }
    }

    async _downloadFromWalrus(blobId, filePath) {
        const url = `${WALRUS_AGGREGATOR}/v1/blobs/${blobId}`;
        console.log(`[BlobCache] Fetching from Walrus: ${blobId}`);

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`Walrus fetch failed: ${response.statusText}`);

            // Use temporary file to avoid partial reads
            const tempPath = `${filePath}.temp`;
            const fileStream = createWriteStream(tempPath);

            // @ts-ignore - ReadableStream/Node stream compat
            await pipeline(Readable.fromWeb(response.body), fileStream);

            fs.renameSync(tempPath, filePath);
            console.log(`[BlobCache] Cached: ${blobId}`);
        } catch (error) {
            console.error(`[BlobCache] Error fetching ${blobId}:`, error);
            throw error;
        }
    }
}

module.exports = new BlobCache();
