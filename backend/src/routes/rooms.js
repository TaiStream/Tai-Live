/**
 * Room Discovery API Routes
 * 
 * Provides endpoints for discovering active live streams.
 */

const express = require('express');
const router = express.Router();

// Reference to signaling server's active rooms (will be set by main app)
let getActiveRooms = () => new Map();

function setRoomsProvider(provider) {
    getActiveRooms = provider;
}

/**
 * GET /api/rooms/active
 * List all active rooms with viewer counts
 */
router.get('/active', (req, res) => {
    const rooms = getActiveRooms();
    const activeRooms = [];

    // Group peers by room
    const roomMap = new Map();
    for (const [peerId, peer] of rooms) {
        if (!roomMap.has(peer.roomId)) {
            roomMap.set(peer.roomId, []);
        }
        roomMap.get(peer.roomId).push(peer);
    }

    // Build response
    for (const [roomId, peers] of roomMap) {
        // Find the first peer as "host" (in reality, we'd track who started broadcasting)
        const host = peers[0];
        activeRooms.push({
            roomId,
            title: `Stream by ${roomId.slice(0, 8)}...`, // Placeholder title
            hostId: host.peerId.slice(0, 8),
            viewerCount: peers.length - 1, // Exclude broadcaster
            startedAt: host.joinedAt || Date.now(),
            tags: ['live', 'p2p']
        });
    }

    res.json({
        count: activeRooms.length,
        rooms: activeRooms
    });
});

/**
 * GET /api/rooms/:roomId
 * Get details about a specific room
 */
router.get('/:roomId', (req, res) => {
    const { roomId } = req.params;
    const rooms = getActiveRooms();

    const roomPeers = [];
    for (const [peerId, peer] of rooms) {
        if (peer.roomId === roomId) {
            roomPeers.push(peer);
        }
    }

    if (roomPeers.length === 0) {
        return res.status(404).json({ error: 'Room not found or inactive' });
    }

    res.json({
        roomId,
        peerCount: roomPeers.length,
        isLive: true
    });
});

module.exports = { router, setRoomsProvider };
