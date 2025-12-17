export interface P2PConfig {
    signalingUrl: string;
    roomId: string;
    peerId: string;
    turnServers: RTCIceServer[];
    privacyMode: boolean;
}
export declare class P2PClient {
    private config;
    private signalClient;
    private peerConnections;
    private localStream;
    private worker;
    private roomKey;
    private roomKeyBytes;
    private roomIV;
    constructor(config: P2PConfig);
    start(stream: MediaStream): Promise<void>;
    private setupE2EE;
    /**
     * Connect to a peer
     */
    connectToPeer(targetPeerId: string, targetPubKey: string): Promise<void>;
    private createPeerConnection;
    private handleSignalMessage;
    private setupSenderEncryption;
    private setupReceiverDecryption;
    /**
     * Cleanup resources
     */
    destroy(): void;
}
