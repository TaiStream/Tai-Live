export interface SignalMessage {
    target_peer_id: string;
    room_id: string;
    payload: string;
    nonce: string;
    sender_pubkey: string;
}
export interface EncryptedPayload {
    type: 'offer' | 'answer' | 'candidate';
    sdp?: string;
    candidate?: any;
}
export declare class SignalClient {
    private signalingUrl;
    private roomId;
    private peerId;
    private ws;
    private callbacks;
    private keyPair;
    private peerPublicKeys;
    private onMessageCallback;
    constructor(signalingUrl: string, roomId: string, peerId: string);
    /**
     * Connect to the signaling server (Node Operator)
     */
    connect(): Promise<void>;
    /**
     * Register self with the signaling server
     */
    private register;
    /**
     * Send an encrypted signaling message to a peer
     */
    sendSignal(targetPeerId: string, payload: EncryptedPayload, targetPublicKeyBase64: string): void;
    /**
     * Handle incoming WebSocket messages
     */
    private handleIncomingMessage;
    /**
     * Decrypt message and notify listener
     */
    private decryptAndDispatch;
    /**
     * Set callback for received decrypted messages
     */
    onMessage(callback: (sender: string, data: EncryptedPayload) => void): void;
    /**
     * Get my public key
     */
    getPublicKey(): string;
}
