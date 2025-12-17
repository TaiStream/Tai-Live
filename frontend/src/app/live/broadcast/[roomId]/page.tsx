'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import LiveChat from '@/components/Live/LiveChat';
import { PredictionWidget } from '@/components/Prediction';
import { Eye, Copy, VideoOff, MicOff, Mic, Video, X, Monitor, Crown, Headphones, Share2 } from 'lucide-react';
import { P2PClient } from '@tai/p2p-client';

// Room type configurations
const ROOM_CONFIGS = {
    audio: {
        name: 'Audio Only',
        icon: Headphones,
        color: 'blue',
        hasVideo: false,
        hasScreenShare: false,
        description: 'Voice-only stream',
    },
    podcast: {
        name: 'Podcast',
        icon: Monitor,
        color: 'green',
        hasVideo: false,
        hasScreenShare: true,
        description: 'Audio + screen share',
    },
    video: {
        name: 'Video',
        icon: Video,
        color: 'purple',
        hasVideo: true,
        hasScreenShare: false,
        description: 'Full video streaming',
    },
    premium: {
        name: 'Premium',
        icon: Crown,
        color: 'amber',
        hasVideo: true,
        hasScreenShare: true,
        description: 'Priority routing + custom branding',
    },
};

type RoomType = keyof typeof ROOM_CONFIGS;

export default function BroadcastPage() {
    const params = useParams();
    const searchParams = useSearchParams();
    const roomId = params.roomId as string;
    const privacyMode = searchParams.get('privacy') === 'true';
    const roomType = (searchParams.get('type') || 'video') as RoomType;

    const config = ROOM_CONFIGS[roomType] || ROOM_CONFIGS.video;

    const [isMuted, setIsMuted] = useState(false);
    const [isVideoOff, setIsVideoOff] = useState(!config.hasVideo);
    const [isScreenSharing, setIsScreenSharing] = useState(false);
    const [viewerCount, setViewerCount] = useState(0);
    const [streamDuration, setStreamDuration] = useState(0);

    const localVideoRef = useRef<HTMLVideoElement>(null);
    const screenShareRef = useRef<HTMLVideoElement>(null);
    const clientRef = useRef<P2PClient | null>(null);
    const startTimeRef = useRef<number>(Date.now());

    // Mock streamer data
    const streamer = {
        name: 'CryptoStreamer',
        address: '0x2ce41c43a6ee1192adc2fe6cc620eef80ca4f57940a5c6cc2d51664514616c14',
        avatar: '/IMG_2262.png',
    };

    useEffect(() => {
        const startMedia = async () => {
            try {
                const constraints = { video: config.hasVideo, audio: true };
                const stream = await navigator.mediaDevices.getUserMedia(constraints);
                if (localVideoRef.current) {
                    localVideoRef.current.srcObject = stream;
                }

                const client = new P2PClient({
                    signalingUrl: 'ws://localhost:8080',
                    roomId: roomId,
                    peerId: crypto.randomUUID(),
                    turnServers: [{ urls: 'turn:localhost:3478', username: 'username', credential: 'password' }],
                    privacyMode: privacyMode
                });

                await client.start(stream);
                clientRef.current = client;
                console.log(`📡 Broadcasting ${roomType} stream for room:`, roomId);
            } catch (err) {
                console.error('Failed to start broadcast:', err);
            }
        };

        startMedia();

        const timer = setInterval(() => {
            setStreamDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
        }, 1000);

        const viewerTimer = setInterval(() => {
            setViewerCount(prev => prev + Math.floor(Math.random() * 3));
        }, 5000);

        return () => {
            clearInterval(timer);
            clearInterval(viewerTimer);
            if (localVideoRef.current?.srcObject) {
                (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }
            if (screenShareRef.current?.srcObject) {
                (screenShareRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
            }
            clientRef.current?.destroy();
        };
    }, [roomId, privacyMode, roomType, config.hasVideo]);

    const toggleMute = () => {
        if (localVideoRef.current?.srcObject) {
            const stream = localVideoRef.current.srcObject as MediaStream;
            stream.getAudioTracks().forEach(t => t.enabled = !t.enabled);
            setIsMuted(!isMuted);
        }
    };

    const toggleVideo = () => {
        if (!config.hasVideo) return;
        if (localVideoRef.current?.srcObject) {
            const stream = localVideoRef.current.srcObject as MediaStream;
            stream.getVideoTracks().forEach(t => t.enabled = !t.enabled);
            setIsVideoOff(!isVideoOff);
        }
    };

    const toggleScreenShare = async () => {
        if (!config.hasScreenShare) return;

        if (isScreenSharing) {
            if (screenShareRef.current?.srcObject) {
                (screenShareRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
                screenShareRef.current.srcObject = null;
            }
            setIsScreenSharing(false);
        } else {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                if (screenShareRef.current) {
                    screenShareRef.current.srcObject = screenStream;
                }
                setIsScreenSharing(true);
                screenStream.getVideoTracks()[0].onended = () => setIsScreenSharing(false);
            } catch (err) {
                console.error('Failed to start screen share:', err);
            }
        }
    };

    const copyShareLink = () => {
        navigator.clipboard.writeText(`${window.location.origin}/live/stream/${roomId}`);
        alert('Stream link copied!');
    };

    const endStream = () => {
        if (localVideoRef.current?.srcObject) {
            (localVideoRef.current.srcObject as MediaStream).getTracks().forEach(t => t.stop());
        }
        clientRef.current?.destroy();
        window.location.href = '/live/dashboard';
    };

    const formatDuration = (s: number) => {
        const hrs = Math.floor(s / 3600);
        const mins = Math.floor((s % 3600) / 60);
        const secs = s % 60;
        return hrs > 0 ? `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}` : `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const Icon = config.icon;
    const colorMap: Record<string, string> = {
        blue: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
        green: 'bg-green-500/20 text-green-400 border-green-500/30',
        purple: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
        amber: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
    };

    return (
        <div className="flex h-[calc(100vh-5rem)] overflow-hidden">
            <div className="flex-1 flex flex-col overflow-y-auto bg-neutral-950">
                {/* Media Container */}
                <div className={`w-full bg-black relative ${config.hasVideo || config.hasScreenShare ? 'aspect-video max-h-[70vh]' : 'h-48'}`}>

                    {/* Audio Only View */}
                    {!config.hasVideo && !isScreenSharing && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-gradient-to-br from-neutral-900 to-neutral-950">
                            <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-4 border ${colorMap[config.color]}`}>
                                <Icon className="w-16 h-16" />
                            </div>
                            <div className="flex items-center gap-1 h-12">
                                {[...Array(20)].map((_, i) => (
                                    <div key={i} className="w-1 rounded-full bg-current animate-pulse" style={{ height: `${20 + Math.random() * 80}%`, animationDelay: `${i * 0.05}s` }} />
                                ))}
                            </div>
                            <p className="text-neutral-400 text-sm mt-4">{config.description}</p>
                        </div>
                    )}

                    {/* Video Feed */}
                    {config.hasVideo && !isScreenSharing && (
                        <video ref={localVideoRef} autoPlay muted playsInline className={`w-full h-full object-cover scale-x-[-1] ${isVideoOff ? 'hidden' : ''}`} />
                    )}

                    {/* Video Off Placeholder */}
                    {config.hasVideo && isVideoOff && !isScreenSharing && (
                        <div className="w-full h-full flex flex-col items-center justify-center bg-neutral-900">
                            <div className="w-24 h-24 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
                                <VideoOff className="w-10 h-10 text-neutral-500" />
                            </div>
                            <p className="text-neutral-500">Camera Off</p>
                        </div>
                    )}

                    {/* Screen Share */}
                    {isScreenSharing && (
                        <video ref={screenShareRef} autoPlay playsInline className="w-full h-full object-contain bg-neutral-900" />
                    )}

                    {/* Hidden audio capture */}
                    {!config.hasVideo && <video ref={localVideoRef} autoPlay muted playsInline className="hidden" />}

                    {/* Overlays */}
                    <div className="absolute top-4 left-4 flex items-center gap-3">
                        <div className="flex items-center gap-2 px-3 py-1.5 bg-red-600 rounded-lg">
                            <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            <span className="text-white text-sm font-bold">LIVE</span>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border ${colorMap[config.color]}`}>
                            <Icon className="w-4 h-4" />
                            <span className="text-sm font-medium">{config.name}</span>
                        </div>
                        <div className="px-3 py-1.5 bg-black/60 backdrop-blur rounded-lg text-white text-sm font-mono">
                            {formatDuration(streamDuration)}
                        </div>
                    </div>

                    <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur rounded-lg">
                        <Eye className="w-4 h-4 text-red-400" />
                        <span className="text-white text-sm font-medium">{viewerCount}</span>
                    </div>

                    {/* Controls */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-3 p-2 bg-black/60 backdrop-blur rounded-xl">
                        <button onClick={toggleMute} className={`p-3 rounded-lg transition-all ${isMuted ? 'bg-red-500/20 text-red-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                            {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
                        </button>
                        {config.hasVideo && (
                            <button onClick={toggleVideo} className={`p-3 rounded-lg transition-all ${isVideoOff ? 'bg-red-500/20 text-red-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                                {isVideoOff ? <VideoOff className="w-5 h-5" /> : <Video className="w-5 h-5" />}
                            </button>
                        )}
                        {config.hasScreenShare && (
                            <button onClick={toggleScreenShare} className={`p-3 rounded-lg transition-all ${isScreenSharing ? 'bg-green-500/20 text-green-500' : 'bg-white/10 hover:bg-white/20 text-white'}`}>
                                <Monitor className="w-5 h-5" />
                            </button>
                        )}
                        <button onClick={copyShareLink} className="p-3 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-all">
                            <Share2 className="w-5 h-5" />
                        </button>
                        <button onClick={endStream} className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-500 text-white font-semibold transition-all flex items-center gap-2">
                            <X className="w-4 h-4" />End
                        </button>
                    </div>
                </div>

                {/* Stream Info */}
                <div className="p-6">
                    <div className="flex justify-between items-start gap-6">
                        <div className="flex gap-4 flex-1">
                            <div className="relative">
                                <div className="w-16 h-16 bg-gradient-to-br from-purple-600 to-blue-600 rounded-full p-0.5">
                                    <div className="w-full h-full bg-neutral-900 rounded-full overflow-hidden border-2 border-neutral-950">
                                        <img src={streamer.avatar} alt={streamer.name} className="w-full h-full object-cover" />
                                    </div>
                                </div>
                                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase tracking-wider border-2 border-neutral-950">Live</div>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white mb-1">Building the Future of Decentralized Streaming</h1>
                                <div className="flex items-center gap-2 text-neutral-400 text-sm">
                                    <span className="text-purple-400 font-medium">{streamer.name}</span>
                                    <span>•</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs border ${colorMap[config.color]}`}>{config.name}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <div className="px-4 py-2 bg-neutral-800 rounded-lg text-neutral-400 text-sm font-mono truncate max-w-xs">
                                tai.gg/live/{roomId.slice(0, 8)}...
                            </div>
                            <button onClick={copyShareLink} className="p-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors">
                                <Copy className="w-5 h-5" />
                            </button>
                        </div>
                    </div>

                    <div className="mt-6">
                        <PredictionWidget roomId={roomId} />
                    </div>

                    <div className="mt-8 grid grid-cols-4 gap-4">
                        <div className="p-4 bg-neutral-900/50 rounded-xl border border-white/5">
                            <p className="text-neutral-500 text-sm mb-1">Viewers</p>
                            <p className="text-2xl font-bold text-white">{viewerCount}</p>
                        </div>
                        <div className="p-4 bg-neutral-900/50 rounded-xl border border-white/5">
                            <p className="text-neutral-500 text-sm mb-1">Duration</p>
                            <p className="text-2xl font-bold text-white">{formatDuration(streamDuration)}</p>
                        </div>
                        <div className="p-4 bg-neutral-900/50 rounded-xl border border-white/5">
                            <p className="text-neutral-500 text-sm mb-1">Tips</p>
                            <p className="text-2xl font-bold text-emerald-400">0 SUI</p>
                        </div>
                        <div className="p-4 bg-neutral-900/50 rounded-xl border border-white/5">
                            <p className="text-neutral-500 text-sm mb-1">Type</p>
                            <p className="text-2xl font-bold text-purple-400">{config.name}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="w-80 hidden lg:block h-full border-l border-white/5">
                <LiveChat />
            </div>
        </div>
    );
}
