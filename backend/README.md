# Tai Node (Reference Implementation)

The **Tai Node** is the backbone of the Tai Network. It acts as a **Decentralized CDN** (dCDN) layer that sits between the client and Walrus storage.

## Key Features
*   **Smart Caching**: Implements a "Read-Through Cache". Heavily requested content is cached on local disk/SSD.
*   **Video Optimization**: Transforms raw Walrus blobs into streamable content via **HTTP Range Requests** (Byte-Range support). This enables seeking and scrubbing in video players.
*   **Signaling**: Facilitates WebRTC connections for live streaming.

## How It Works
1.  **Client Request**: Player requests `GET /stream/:manifestId` (or `:chunkId`).
2.  **Cache Lookup**: Node checks `data/cache` for the content.
3.  **Walrus Fetch**: If missing, Node fetches the blob from **Walrus Aggregator** and pipes it to disk + client.
4.  **Delivery**: Node serves the content with `Partial Content (206)` status if requested.

## Usage
### Start the Node
```bash
npm install
npm start
```
Runs on `http://localhost:3001`.

### API
*   `GET /stream/:blobId` - Stream a video chunk. Supports `Range: bytes=x-y`.
*   `GET /` - Health check.

## Architecture
Built with Node.js and Express.
*   `src/routes/delivery.js`: Core video delivery logic.
*   `src/services/blobCache.js`: Caching layer interacting with Walrus.
