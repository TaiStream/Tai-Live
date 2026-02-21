'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import StreamPlayer from '@/components/Live/StreamPlayer';
import LiveChat from '@/components/Live/LiveChat';
import { TipButton } from '@/components/Tip';
import { PredictionWidget } from '@/components/Prediction';
import { User, Share2, Heart, MoreHorizontal } from 'lucide-react';
import { P2PClient } from '@tai/p2p-client';

export default function StreamPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const username = params.username as string;
    const privacyMode = searchParams.get('privacy') === 'true';
    const mode = (searchParams.get('mode') || 'p2p') as 'p2p' | 'relay';

    // State
    const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
    const [isConnected, setIsConnected] = useState(false);
    const clientRef = useRef<P2PClient | null>(null);

    // TODO: Fetch streamer address from on-chain profile by username
    // For now, pass through from query params or use empty placeholder
    const streamerAddress = searchParams.get('streamer') || '';

    useEffect(() => {
        // Mode 1: Relay (Broadcast)
        if (mode === 'relay') {
            // StreamPlayer handles WS connection internally via MSE
            setIsConnected(true); // Assume connected for UI state, Player handles real connection
            return;
        }

        // Mode 2: P2P (Meeting/Co-Stream)
        const joinP2PRoom = async () => {
            try {
                // For viewer, we don't need to capture media
                const client = new P2PClient({
                    signalingUrl: 'ws://localhost:8080',
                    roomId: username, // Use username as room ID
                    peerId: crypto.randomUUID(),
                    turnServers: [{ urls: 'turn:localhost:3478', username: 'username', credential: 'password' }],
                    privacyMode: privacyMode
                });

                // Handle incoming tracks from broadcaster
                (client as any).onTrack = (stream: MediaStream, peerId: string) => {
                    console.log('🎥 Received stream from broadcaster:', peerId);
                    setRemoteStream(stream);
                    setIsConnected(true);
                };

                (client as any).onPeerDisconnect = (peerId: string) => {
                    console.log('❌ Broadcaster disconnected:', peerId);
                    setRemoteStream(null);
                    setIsConnected(false);
                };

                // Start without local stream (viewer mode)
                await client.start(null as any);
                clientRef.current = client;
                console.log('📡 Joined P2P room as viewer:', username);
            } catch (err) {
                console.error('Failed to join room:', err);
            }
        };

        joinP2PRoom();

        return () => {
            clientRef.current?.destroy();
        };
    }, [username, privacyMode, mode]);

    return (
        <div className="flex h-[calc(100vh-5rem)] overflow-hidden">
            {/* Main Content (Player + Info) */}
            <div className="flex-1 flex flex-col overflow-y-auto bg-neutral-950">
                {/* Player Container */}
                <div className="w-full bg-black aspect-video max-h-[70vh]">
                    <StreamPlayer
                        stream={remoteStream}
                        streamUrl={mode === 'relay' ? 'ws://localhost:8081' : undefined}
                        isLive={isConnected}
                    />
                </div>

                {/* Stream Info */}
                <div className="p-6">
                    <div className="flex justify-between items-start gap-6">
                        <div className="flex gap-4 flex-1">
                            {/* Avatar */}
                            <div className="relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full p-0.5">
                                    <div className="w-full h-full bg-neutral-900 rounded-full flex items-center justify-center border-2 border-neutral-950">
                                        <User className="w-8 h-8 text-white" />
                                    </div>
                                </div>
                                {isConnected && (
                                    <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase tracking-wider border-2 border-neutral-950">
                                        Live
                                    </div>
                                )}
                            </div>

                            {/* Text Info */}
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-1">Building the Future of Decentralized Streaming</h1>
                                <div className="flex items-center gap-2 text-neutral-400 text-sm mb-3">
                                    <span className="text-purple-400 font-medium hover:underline cursor-pointer">{username}</span>
                                    <span>•</span>
                                    <span className="hover:text-purple-400 cursor-pointer">Just Chatting</span>
                                    <span>•</span>
                                    <div className="flex gap-1">
                                        <span className="px-2 py-0.5 bg-white/5 rounded-full text-xs">Web3</span>
                                        <span className="px-2 py-0.5 bg-white/5 rounded-full text-xs">Sui</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-2">
                            <TipButton
                                recipientAddress={streamerAddress}
                                recipientName={username}
                            />
                            <button className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors">
                                <Heart className="w-4 h-4" />
                                <span>Follow</span>
                            </button>
                            <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium transition-colors">
                                Subscribe
                            </button>
                            <button className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <Share2 className="w-5 h-5" />
                            </button>
                            <button className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                                <MoreHorizontal className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    {/* Prediction Widget */}
                    <div className="mt-6">
                        <PredictionWidget roomId={username} />
                    </div>

                    {/* Stats / About */}
                    <div className="mt-8 p-6 bg-neutral-900/50 rounded-xl border border-white/5">
                        <h3 className="text-lg font-bold text-white mb-4">About {username}</h3>
                        <p className="text-neutral-400 leading-relaxed max-w-3xl">
                            Welcome to the official stream! We are building the next generation of decentralized applications on Sui.
                            Join us as we explore Move smart contracts, Walrus storage, and P2P networking.
                            Stake SUI to unlock higher tiers and earn points for every minute you watch!
                        </p>
                    </div>
                </div>
            </div>

            {/* Chat Sidebar */}
            <div className="w-80 hidden lg:block h-full border-l border-white/5">
                <LiveChat />
            </div>
        </div>
    );
}

