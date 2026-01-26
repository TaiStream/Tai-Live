const express = require('express');
const fs = require('fs');
const blobCache = require('../services/blobCache');

const router = express.Router();

// GET /stream/:blobId
// Handles standard requests and Range requests for video seeking
router.get('/stream/:blobId', async (req, res) => {
    const { blobId } = req.params;
    const range = req.headers.range;

    try {
        // 1. Ensure file is available locally (Read-Through Cache)
        // Note: For large files in a real CDN, we'd stream immediately.
        // For this Prototype, we download first to guarantee robust Range support.
        const filePath = await blobCache.ensureCached(blobId);

        const stat = fs.statSync(filePath);
        const fileSize = stat.size;

        // 2. Handle Range Request (Video Seeking)
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
            const chunksize = (end - start) + 1;

            const file = fs.createReadStream(filePath, { start, end });

            const head = {
                'Content-Range': `bytes ${start}-${end}/${fileSize}`,
                'Accept-Ranges': 'bytes',
                'Content-Length': chunksize,
                'Content-Type': 'video/mp4', // Implicitly assuming MP4 for prototype
            };

            res.writeHead(206, head); // 206 Partial Content
            file.pipe(res);
        } else {
            // 3. Handle Regular Download
            const head = {
                'Content-Length': fileSize,
                'Content-Type': 'video/mp4',
            };
            res.writeHead(200, head);
            fs.createReadStream(filePath).pipe(res);
        }
    } catch (error) {
        console.error('[Delivery] Error:', error);
        res.status(500).json({ error: 'Failed to stream content' });
    }
});

module.exports = router;
