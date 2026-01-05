const { WebSocketServer, WebSocket } = require('ws');

/**
 * Simple Signaling Server for WebRTC coordination
 * Handles peer registration, room join/leave, and message relay
 */
function startSignalingServer(port) {
    const wss = new WebSocketServer({ port });
    const peers = new Map(); // peerId -> Peer { ws, roomId, peerId, publicKey, joinedAt }

    console.log(`🔌 Signaling server running on ws://localhost:${port}`);

    wss.on('connection', (ws) => {
        let myPeerId = null;
        let myRoomId = null;

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.method === 'register') {
                    myPeerId = data.params.peer_id;
                    myRoomId = data.params.room_id;
                    const publicKey = data.params.public_key;

                    if (myPeerId && myRoomId) {
                        peers.set(myPeerId, {
                            ws,
                            roomId: myRoomId,
                            peerId: myPeerId,
                            publicKey,
                            joinedAt: Date.now()
                        });

                        // Send JSON-RPC response
                        ws.send(JSON.stringify({
                            jsonrpc: '2.0',
                            result: 'registered',
                            id: data.id
                        }));
                        console.log(`✅ Peer ${myPeerId.slice(0, 8)}... joined room ${myRoomId.slice(0, 8)}...`);

                        // Notify existing peers in the room about new peer
                        for (const [id, peer] of peers) {
                            if (peer.roomId === myRoomId && peer.peerId !== myPeerId) {
                                peer.ws.send(JSON.stringify({
                                    jsonrpc: '2.0',
                                    method: 'peer_joined',
                                    params: { peer_id: myPeerId, public_key: publicKey }
                                }));
                            }
                        }

                        // Tell new peer about existing peers
                        for (const [id, peer] of peers) {
                            if (peer.roomId === myRoomId && peer.peerId !== myPeerId && peer.publicKey) {
                                ws.send(JSON.stringify({
                                    jsonrpc: '2.0',
                                    method: 'peer_joined',
                                    params: { peer_id: peer.peerId, public_key: peer.publicKey }
                                }));
                            }
                        }
                    }
                } else if (data.method === 'relay_message') {
                    const targetPeerId = data.params.target_peer_id;
                    const targetPeer = peers.get(targetPeerId);

                    if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
                        targetPeer.ws.send(JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'relay_message',
                            params: data.params
                        }));
                    }
                }
            } catch (e) {
                console.error('❌ Failed to handle message', e);
            }
        });

        ws.on('close', () => {
            if (myPeerId) {
                // Notify other peers in room about disconnect
                const peer = peers.get(myPeerId);
                if (peer) {
                    for (const [id, otherPeer] of peers) {
                        if (otherPeer.roomId === peer.roomId && otherPeer.peerId !== myPeerId) {
                            otherPeer.ws.send(JSON.stringify({
                                jsonrpc: '2.0',
                                method: 'peer_left',
                                params: { peer_id: myPeerId }
                            }));
                        }
                    }
                }
                peers.delete(myPeerId);
                console.log(`❌ Peer ${myPeerId.slice(0, 8)}... disconnected`);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });
    });

    return { wss, peers };
}

module.exports = { startSignalingServer };

