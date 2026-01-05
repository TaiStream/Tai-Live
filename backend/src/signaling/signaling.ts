import { WebSocketServer, WebSocket } from 'ws';

interface Peer {
    ws: WebSocket;
    roomId: string;
    peerId: string;
}

export function startSignalingServer(port: number) {
    const wss = new WebSocketServer({ port });
    const peers = new Map<string, Peer>(); // peerId -> Peer

    wss.on('connection', (ws) => {
        let myPeerId: string | null = null;
        let myRoomId: string | null = null;

        ws.on('message', (message) => {
            try {
                const data = JSON.parse(message.toString());

                if (data.method === 'register') {
                    myPeerId = data.params.peer_id;
                    myRoomId = data.params.room_id;
                    if (myPeerId && myRoomId) {
                        peers.set(myPeerId, { ws, roomId: myRoomId, peerId: myPeerId });

                        // Send JSON-RPC response
                        ws.send(JSON.stringify({
                            jsonrpc: '2.0',
                            result: 'registered',
                            id: data.id
                        }));
                        console.log(`Peer ${myPeerId} joined room ${myRoomId}`);

                        // Tell new peer about existing peers in the room
                        for (const [id, peer] of peers) {
                            if (peer.roomId === myRoomId && peer.peerId !== myPeerId) {
                                // We need to get the public_key from somewhere... let's store it!
                                // For now, we'll skip this and only notify existing peers
                            }
                        }

                        // Notify existing peers in the room about new peer
                        for (const [id, peer] of peers) {
                            if (peer.roomId === myRoomId && peer.peerId !== myPeerId) {
                                // Tell existing peer about new peer
                                peer.ws.send(JSON.stringify({
                                    jsonrpc: '2.0',
                                    method: 'peer_joined',
                                    params: { peer_id: myPeerId, public_key: data.params.public_key }
                                }));
                            }
                        }

                        // Store public key so we can tell new peers about existing ones
                        (peers.get(myPeerId) as any).publicKey = data.params.public_key;

                        // NOW tell the new peer about existing peers
                        for (const [id, peer] of peers) {
                            if (peer.roomId === myRoomId && peer.peerId !== myPeerId && (peer as any).publicKey) {
                                ws.send(JSON.stringify({
                                    jsonrpc: '2.0',
                                    method: 'peer_joined',
                                    params: { peer_id: peer.peerId, public_key: (peer as any).publicKey }
                                }));
                            }
                        }
                    }
                } else if (data.method === 'relay_message') {
                    const targetPeerId = data.params.target_peer_id;
                    const targetPeer = peers.get(targetPeerId);

                    if (targetPeer && targetPeer.ws.readyState === WebSocket.OPEN) {
                        // Forward the message in JSON-RPC format
                        targetPeer.ws.send(JSON.stringify({
                            jsonrpc: '2.0',
                            method: 'relay_message',
                            params: data.params
                        }));
                    }
                }
            } catch (e) {
                console.error('Failed to handle message', e);
            }
        });

        ws.on('close', () => {
            if (myPeerId) {
                peers.delete(myPeerId);
                console.log(`Peer ${myPeerId} disconnected`);
            }
        });
    });

    return wss;
}
