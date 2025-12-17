"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SignalClient = void 0;
const isomorphic_ws_1 = __importDefault(require("isomorphic-ws"));
const crypto_1 = require("./crypto");
class SignalClient {
    constructor(signalingUrl, roomId, peerId // My ID (e.g. wallet address)
    ) {
        this.signalingUrl = signalingUrl;
        this.roomId = roomId;
        this.peerId = peerId;
        this.callbacks = new Map();
        this.peerPublicKeys = new Map();
        this.onMessageCallback = null;
        this.keyPair = crypto_1.CryptoUtils.generateKeyPair();
    }
    /**
     * Connect to the signaling server (Node Operator)
     */
    async connect() {
        return new Promise((resolve, reject) => {
            this.ws = new isomorphic_ws_1.default(this.signalingUrl);
            this.ws.onopen = () => {
                console.log('Connected to signaling server');
                this.register();
                resolve();
            };
            this.ws.onerror = (err) => {
                console.error('WebSocket error:', err);
                reject(err);
            };
            this.ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    this.handleIncomingMessage(event.data.toString());
                }
                catch (e) {
                    console.error('Failed to parse message', e);
                }
            };
        });
    }
    /**
     * Register self with the signaling server
     */
    register() {
        if (!this.ws)
            return;
        const msg = {
            jsonrpc: '2.0',
            method: 'register',
            params: {
                peer_id: this.peerId,
                room_id: this.roomId,
                public_key: crypto_1.CryptoUtils.toBase64(this.keyPair.publicKey)
            },
            id: Date.now()
        };
        this.ws.send(JSON.stringify(msg));
    }
    /**
     * Send an encrypted signaling message to a peer
     */
    sendSignal(targetPeerId, payload, targetPublicKeyBase64) {
        if (!this.ws)
            throw new Error('Not connected');
        let targetPubKey = this.peerPublicKeys.get(targetPeerId);
        if (!targetPubKey) {
            targetPubKey = crypto_1.CryptoUtils.fromBase64(targetPublicKeyBase64);
            this.peerPublicKeys.set(targetPeerId, targetPubKey);
        }
        const payloadStr = JSON.stringify(payload);
        const { nonce, ciphertext } = crypto_1.CryptoUtils.encryptMessage(payloadStr, targetPubKey, this.keyPair.secretKey);
        const msg = {
            target_peer_id: targetPeerId,
            room_id: this.roomId,
            payload: crypto_1.CryptoUtils.toBase64(ciphertext),
            nonce: crypto_1.CryptoUtils.toBase64(nonce),
            sender_pubkey: crypto_1.CryptoUtils.toBase64(this.keyPair.publicKey)
        };
        const rpcMsg = {
            jsonrpc: '2.0',
            method: 'relay_message',
            params: msg,
            id: Date.now()
        };
        this.ws.send(JSON.stringify(rpcMsg));
    }
    /**
     * Handle incoming WebSocket messages
     */
    handleIncomingMessage(data) {
        try {
            const rpcMsg = JSON.parse(data);
            // Handle registration response or other system messages
            if (rpcMsg.result === 'registered')
                return;
            // Handle relayed messages
            if (rpcMsg.method === 'relay_message') {
                const params = rpcMsg.params;
                this.decryptAndDispatch(params);
            }
        }
        catch (e) {
            console.error('Failed to parse incoming message', e);
        }
    }
    /**
     * Decrypt message and notify listener
     */
    decryptAndDispatch(msg) {
        const senderPubKey = crypto_1.CryptoUtils.fromBase64(msg.sender_pubkey);
        const nonce = crypto_1.CryptoUtils.fromBase64(msg.nonce);
        const ciphertext = crypto_1.CryptoUtils.fromBase64(msg.payload);
        const plaintext = crypto_1.CryptoUtils.decryptMessage(ciphertext, nonce, senderPubKey, this.keyPair.secretKey);
        if (plaintext && this.onMessageCallback) {
            const payload = JSON.parse(plaintext);
            // We use the sender's public key as their ID for now if peer_id isn't explicit in the outer layer source
            // In a real implementation, the relay should include 'source_peer_id'
            this.onMessageCallback(msg.sender_pubkey, payload);
        }
    }
    /**
     * Set callback for received decrypted messages
     */
    onMessage(callback) {
        this.onMessageCallback = callback;
    }
    /**
     * Get my public key
     */
    getPublicKey() {
        return crypto_1.CryptoUtils.toBase64(this.keyPair.publicKey);
    }
}
exports.SignalClient = SignalClient;
