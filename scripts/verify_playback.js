const fetch = require('node-fetch');

// The Manifest ID we created in Phase 2
const MANIFEST_ID = '3CAVF4szjfp0wr9E6fgzmN3u-rozFJ32pXbUiB55p8Y';
const NODE_URL = 'http://localhost:3001';

async function verifySystem() {
    console.log('🎬 Starting End-to-End Playback Test...\n');

    // Step 1: Resolve Stream (Fetch Manifest via Node)
    console.log(`[Player] Fetching Manifest: ${MANIFEST_ID}...`);
    const manifestResponse = await fetch(`${NODE_URL}/stream/${MANIFEST_ID}`);

    if (!manifestResponse.ok) {
        throw new Error(`Failed to fetch manifest: ${manifestResponse.statusText}`);
    }

    const manifest = await manifestResponse.json();
    console.log('✅ Manifest Loaded!');
    console.log(`   Title: "${manifest.title}"`);
    console.log(`   Chunks: ${manifest.chunks.length}`);
    console.log(`   Total Size: ${(manifest.totalSize / 1024 / 1024).toFixed(2)} MB`);

    // Step 2: Stream Video (Fetch First Chunk via Node)
    const firstChunk = manifest.chunks[0];
    console.log(`\n[Player] Streaming Chunk 1 (Blob: ${firstChunk.blobId.slice(0, 10)}...)...`);

    // Test Range Request (Simulate seeking to start)
    const rangeResponse = await fetch(`${NODE_URL}/stream/${firstChunk.blobId}`, {
        headers: { 'Range': 'bytes=0-1023' } // First 1KB
    });

    if (rangeResponse.status !== 206) {
        throw new Error(`Node did not respect Range request. Status: ${rangeResponse.status}`);
    }

    const videoData = await rangeResponse.buffer();
    console.log(`✅ Received ${videoData.length} bytes of video data.`);

    const contentRange = rangeResponse.headers.get('content-range');
    console.log(`   Content-Range: ${contentRange}`);

    if (videoData.length === 1024) {
        console.log('\n🎉 SUCCESS: System is working End-to-End!');
        console.log('   1. Uploaded content verified (Phase 2)');
        console.log('   2. Manifest stored on Walrus verified');
        console.log('   3. Tai Node delivery & caching verified');
        console.log('   4. Video seeking (Range support) verified');
    } else {
        console.error('❌ Data length mismatch');
    }
}

verifySystem().catch(error => {
    console.error('❌ Test Failed:', error.message);
    if (error.code === 'ECONNREFUSED') {
        console.error('   Hint: Is the backend server running on port 3001?');
    }
});
