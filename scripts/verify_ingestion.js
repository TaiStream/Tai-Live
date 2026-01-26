// Polyfills for Node environment
const fetch = require('node-fetch');
const { Blob } = require('buffer');
global.fetch = fetch;
global.Blob = Blob; // Minimal polyfill for Blob

// Mock File since it doesn't exist in Node
class MockFile {
    constructor(buffer, name, type) {
        this.buffer = buffer;
        this.name = name;
        this.type = type;
        this.size = buffer.length;
    }

    slice(start, end) {
        // Return a Blob-like object for uploadToWalrus
        const sliced = this.buffer.subarray(start, end);
        return {
            size: sliced.length,
            type: this.type,
            // Custom arrayBuffer method for node-fetch body
            arrayBuffer: async () => sliced.buffer.slice(sliced.byteOffset, sliced.byteOffset + sliced.length),
            stream: () => {
                const { Readable } = require('stream');
                return Readable.from(sliced);
            },
            // Being explicit for our hacked uploadToWalrus
            length: sliced.length,
            [Symbol.toStringTag]: 'Blob'
        };
    }
}

// Import the client (we need to modify the import since it's TS source)
// Since we can't easily run TS, I will inline the relevant logic here for the TEST script
// utilizing the exact code structure I just wrote.

const WALRUS_AGGREGATOR = 'https://aggregator.walrus-testnet.walrus.space';
const WALRUS_PUBLISHER = 'https://publisher.walrus-testnet.walrus.space';

async function uploadToWalrus(fileBody) {
    const response = await fetch(`${WALRUS_PUBLISHER}/v1/blobs?epochs=5`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/octet-stream' },
        body: fileBody.buffer ? fileBody.buffer : fileBody // Handle buffer direct
    });

    if (!response.ok) throw new Error(await response.text());
    const data = await response.json();
    return data.newlyCreated?.blobObject?.blobId || data.alreadyCertified?.blobObject?.blobId;
}

async function runTest() {
    console.log('🧪 Starting Ingestion Test...');

    // 1. Create a "Large" File (15MB to force 2 chunks of 10MB)
    const CHUNK_SIZE = 10 * 1024 * 1024;
    const FILE_SIZE = 15 * 1024 * 1024;
    const buffer = Buffer.alloc(FILE_SIZE, 'a'); // Fill with 'a'

    console.log(`📦 Generated ${FILE_SIZE / 1024 / 1024}MB Test File`);

    // 2. Chunking Logic (mirrors walrusClient.ts)
    const totalChunks = Math.ceil(FILE_SIZE / CHUNK_SIZE);
    const uploadedChunks = [];

    for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, FILE_SIZE);
        const chunkBuf = buffer.subarray(start, end);

        console.log(`⬆️ Uploading Chunk ${i + 1}/${totalChunks} (${chunkBuf.length} bytes)...`);
        const blobId = await uploadToWalrus(chunkBuf);
        console.log(`   ✅ Chunk ${i + 1} Blob ID: ${blobId}`);

        uploadedChunks.push({
            index: i,
            blobId,
            offsetStart: start,
            offsetEnd: end,
            size: chunkBuf.length
        });
    }

    // 3. Create Manifest
    const manifest = {
        version: '1.0',
        title: 'Ingestion Test Video',
        durationMs: 0,
        mimeType: 'video/mp4',
        totalSize: FILE_SIZE,
        chunks: uploadedChunks,
        createdAt: Date.now()
    };

    console.log('📝 Manifest created:', JSON.stringify(manifest, null, 2));

    // 4. Upload Manifest
    const manifestStr = JSON.stringify(manifest);
    const manifestBlobId = await uploadToWalrus(Buffer.from(manifestStr));

    console.log('\n🎉 SUCCESS! Manifest Uploaded.');
    console.log(`🔗 Manifest ID: ${manifestBlobId}`);
    console.log(`👉 Verify: curl http://localhost:3001/stream/${manifestBlobId}`);
}

runTest().catch(console.error);
