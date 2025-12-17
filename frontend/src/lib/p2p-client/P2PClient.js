"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.P2PClient = void 0;
const SignalClient_1 = require("./SignalClient");
class P2PClient {
    constructor(config) {
        this.config = config;
        this.peerConnections = new Map();
        this.localStream = null;
        this.worker = null;
        this.roomKey = null; // Shared room key for media
        this.roomKeyBytes = null;
        this.roomIV = null;
        this.signalClient = new SignalClient_1.SignalClient(config.signalingUrl, config.roomId, config.peerId);
        this.signalClient.onMessage(this.handleSignalMessage.bind(this));
        // Initialize E2EE worker only if privacy mode is enabled
        if (this.config.privacyMode) {
            // In a real build, we'd load this from a URL or blob
            // this.worker = new Worker('./worker.js'); 
        }
    }
    async start(stream) {
        this.localStream = stream;
        await this.signalClient.connect();
        // Generate a random room key for testing (in prod, this comes from key exchange)
        // For now, we assume a pre-shared key or one derived from the room ID for simplicity of the prototype
        // In the full design, we use the Ratchet key exchange
        if (this.config.privacyMode) {
            await this.setupE2EE();
        }
    }
    async setupE2EE() {
        // Mock key generation for prototype
        const key = await window.crypto.subtle.generateKey({ name: 'AES-GCM', length: 128 }, true, ['encrypt', 'decrypt']);
        this.roomKey = key;
        this.roomKeyBytes = new Uint8Array(await window.crypto.subtle.exportKey('raw', key));
        this.roomIV = window.crypto.getRandomValues(new Uint8Array(12));
    }
    /**
     * Connect to a peer
     */
    async connectToPeer(targetPeerId, targetPubKey) {
        const pc = this.createPeerConnection(targetPeerId, targetPubKey);
        // Add tracks
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                const sender = pc.addTrack(track, this.localStream);
                if (this.config.privacyMode) {
                    this.setupSenderEncryption(sender);
                }
            });
        }
        // Create Offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        this.signalClient.sendSignal(targetPeerId, { type: 'offer', sdp: offer.sdp }, targetPubKey);
    }
    createPeerConnection(targetPeerId, targetPubKey) {
        const iceTransportPolicy = this.config.privacyMode ? 'relay' : 'all';
        const pc = new RTCPeerConnection({
            iceServers: this.config.turnServers, // In standard mode, these might include public STUN servers
            iceTransportPolicy: iceTransportPolicy
        });
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                this.signalClient.sendSignal(targetPeerId, { type: 'candidate', candidate: event.candidate }, targetPubKey);
            }
        };
        pc.ontrack = (event) => {
            const receiver = event.receiver;
            if (this.config.privacyMode) {
                this.setupReceiverDecryption(receiver);
            }
            // Notify app of new stream
            // this.onTrack(event.streams[0]);
        };
        this.peerConnections.set(targetPeerId, pc);
        return pc;
    }
    async handleSignalMessage(senderPubKey, payload) {
        // Use senderPubKey as peerId for now
        const peerId = senderPubKey;
        let pc = this.peerConnections.get(peerId);
        if (!pc) {
            pc = this.createPeerConnection(peerId, senderPubKey);
        }
        if (payload.type === 'offer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp: payload.sdp }));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            this.signalClient.sendSignal(peerId, { type: 'answer', sdp: answer.sdp }, senderPubKey);
        }
        else if (payload.type === 'answer') {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp: payload.sdp }));
        }
        else if (payload.type === 'candidate') {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
        }
    }
    setupSenderEncryption(sender) {
        // @ts-ignore - insertable streams API
        const streams = sender.createEncodedStreams();
        const readable = streams.readable;
        const writable = streams.writable;
        // In a real app, we would spawn a worker here. 
        // For this prototype file, we'll just note where the worker hookup happens.
        /*
        const worker = new Worker('worker.js');
        worker.postMessage({
            operation: 'encrypt',
            readable,
            writable,
            keyBytes: this.roomKeyBytes,
            ivBytes: this.roomIV
        }, [readable, writable]);
        */
    }
    setupReceiverDecryption(receiver) {
        // @ts-ignore
        const streams = receiver.createEncodedStreams();
        const readable = streams.readable;
        const writable = streams.writable;
        /*
        const worker = new Worker('worker.js');
        worker.postMessage({
            operation: 'decrypt',
            readable,
            writable,
            keyBytes: this.roomKeyBytes,
            ivBytes: this.roomIV
        }, [readable, writable]);
        */
    }
    /**
     * Cleanup resources
     */
    destroy() {
        this.localStream?.getTracks().forEach(track => track.stop());
        this.peerConnections.forEach(pc => pc.close());
        this.peerConnections.clear();
        // this.signalClient.destroy(); // SignalClient needs destroy too?
        // For now just close the socket if exposed or add destroy to SignalClient
    }
}
exports.P2PClient = P2PClient;
