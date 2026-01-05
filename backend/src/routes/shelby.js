/**
 * Shelby API Routes
 * 
 * Handles stream chunk uploads to Shelby decentralized storage
 * for VOD recording and playback.
 */

const express = require('express');
const router = express.Router();

// In-memory storage for stream segments (in production, use a proper database)
const streamSegments = new Map(); // streamId -> Array<{ url, timestamp }>

// Mock Shelby upload (replace with real SDK when keys are configured)
// To use real Shelby, uncomment the SDK import and configure SHELBY_PRIVATE_KEY
// const { ShelbyNodeClient } = require('@shelby-protocol/sdk');

const SHELBY_ENABLED = process.env.SHELBY_PRIVATE_KEY ? true : false;
let shelbyClient = null;

if (SHELBY_ENABLED) {
    // Initialize real Shelby client
    // shelbyClient = new ShelbyNodeClient({
    //     privateKey: process.env.SHELBY_PRIVATE_KEY,
    //     network: process.env.SHELBY_NETWORK || 'testnet'
    // });
    console.log('🌐 Shelby integration enabled');
} else {
    console.log('⚠️ Shelby not configured - using mock storage');
}

/**
 * POST /api/shelby/upload
 * Upload a stream chunk to Shelby
 */
router.post('/upload', express.raw({ type: 'video/webm', limit: '10mb' }), async (req, res) => {
    try {
        const streamId = req.headers['x-stream-id'];
        const chunkIndex = req.headers['x-chunk-index'];
        const timestamp = Date.now();

        if (!streamId) {
            return res.status(400).json({ error: 'Missing x-stream-id header' });
        }

        let blobUrl;

        if (SHELBY_ENABLED && shelbyClient) {
            // Real Shelby upload
            const result = await shelbyClient.upload({
                bucket: 'tai-live-streams',
                name: `${streamId}/${chunkIndex}.webm`,
                data: req.body,
                options: { encrypt: false, redundancy: 'high' }
            });
            blobUrl = result.url;
        } else {
            // Mock storage - just store metadata
            blobUrl = `mock://shelby/${streamId}/${chunkIndex}.webm`;
        }

        // Track segment
        if (!streamSegments.has(streamId)) {
            streamSegments.set(streamId, []);
        }
        streamSegments.get(streamId).push({ url: blobUrl, timestamp, chunkIndex });

        console.log(`📦 Chunk ${chunkIndex} uploaded for stream ${streamId.slice(0, 8)}...`);
        res.json({ success: true, url: blobUrl, chunkIndex });
    } catch (error) {
        console.error('Shelby upload failed:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * GET /api/shelby/vod/:streamId
 * Get VOD segments for playback
 */
router.get('/vod/:streamId', (req, res) => {
    const { streamId } = req.params;
    const segments = streamSegments.get(streamId) || [];

    if (segments.length === 0) {
        return res.status(404).json({ error: 'No recording found for this stream' });
    }

    res.json({
        streamId,
        segmentCount: segments.length,
        segments: segments.sort((a, b) => a.timestamp - b.timestamp)
    });
});

/**
 * DELETE /api/shelby/stream/:streamId
 * Clear stream recording (for cleanup)
 */
router.delete('/stream/:streamId', (req, res) => {
    const { streamId } = req.params;
    streamSegments.delete(streamId);
    res.json({ success: true, message: 'Stream recording cleared' });
});

module.exports = router;
