'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { User, Radio, Wifi, WifiOff } from 'lucide-react';

interface ActiveRoom {
    roomId: string;
    title: string;
    hostId: string;
    viewerCount: number;
    startedAt: number;
    tags: string[];
}

export default function LiveHome() {
    const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchRooms = async () => {
            try {
                const res = await fetch('http://localhost:3001/api/rooms/active');
                if (res.ok) {
                    const data = await res.json();
                    setActiveRooms(data.rooms || []);
                }
            } catch (error) {
                console.error('Failed to fetch active rooms:', error);
            } finally {
                setIsLoading(false);
            }
        };

        fetchRooms();

        // Poll every 5 seconds
        const interval = setInterval(fetchRooms, 5000);
        return () => clearInterval(interval);
    }, []);

    const featuredStreams = [
        {
            user: 'SuiFoundation',
            title: 'Building the Future of Decentralized Streaming on Sui',
            game: 'Just Chatting',
            viewers: '1.2k',
            thumbnail: 'bg-gradient-to-br from-blue-600 to-purple-600',
            tags: ['Web3', 'Sui', 'Tech']
        },
        {
            user: 'MystenLabs',
            title: 'Live Coding: Move Smart Contracts from Scratch',
            game: 'Coding',
            viewers: '850',
            thumbnail: 'bg-gradient-to-br from-indigo-600 to-blue-500',
            tags: ['Coding', 'Move', 'Education']
        },
        {
            user: 'CryptoGamer',
            title: 'Sui 8192 High Score Attempt! 🎮',
            game: 'Sui 8192',
            viewers: '3.4k',
            thumbnail: 'bg-gradient-to-br from-purple-600 to-pink-600',
            tags: ['Gaming', 'Sui8192']
        },
        {
            user: 'MoveDev',
            title: 'Advanced Move Patterns & Security',
            game: 'Move Language',
            viewers: '2.1k',
            thumbnail: 'bg-gradient-to-br from-green-600 to-teal-600',
            tags: ['Dev', 'Security']
        },
        {
            user: 'DeFi_Wizard',
            title: 'Market Analysis & Trading Strategy',
            game: 'Trading',
            viewers: '1.5k',
            thumbnail: 'bg-gradient-to-br from-orange-600 to-red-600',
            tags: ['Finance', 'DeFi']
        },
        {
            user: 'NFT_Artist',
            title: 'Creating Digital Art for the Metaverse',
            game: 'Art',
            viewers: '900',
            thumbnail: 'bg-gradient-to-br from-pink-600 to-rose-600',
            tags: ['Art', 'NFT']
        }
    ];

    return (
        <div className="p-6 md:p-8">
            {/* Live P2P Rooms Section */}
            <div className="mb-12">
                <div className="flex items-center gap-3 mb-6">
                    <Radio className="w-5 h-5 text-red-500 animate-pulse" />
                    <h2 className="text-2xl font-bold text-white">Live Now (P2P)</h2>
                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">
                        {activeRooms.length} active
                    </span>
                </div>

                {isLoading ? (
                    <div className="flex items-center gap-3 text-neutral-500 p-8">
                        <Wifi className="w-5 h-5 animate-pulse" />
                        <span>Scanning for live streams...</span>
                    </div>
                ) : activeRooms.length === 0 ? (
                    <div className="flex flex-col items-center justify-center bg-neutral-900/50 rounded-xl p-12 border border-white/5">
                        <WifiOff className="w-12 h-12 text-neutral-600 mb-4" />
                        <p className="text-neutral-400 text-lg mb-2">No live streams right now</p>
                        <p className="text-neutral-500 text-sm">Be the first to go live!</p>
                        <Link
                            href={`/live/broadcast/${crypto.randomUUID().slice(0, 8)}`}
                            className="mt-4 px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg font-medium transition-colors"
                        >
                            Start Streaming
                        </Link>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                        {activeRooms.map((room) => (
                            <Link
                                key={room.roomId}
                                href={`/live/stream/${room.roomId}`}
                                className="group block"
                            >
                                <div className="aspect-video rounded-xl overflow-hidden mb-3 relative bg-gradient-to-br from-purple-900/50 to-blue-900/50 border border-purple-500/20">
                                    <div className="absolute top-2 left-2 flex gap-2">
                                        <span className="px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase flex items-center gap-1">
                                            <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
                                            P2P Live
                                        </span>
                                    </div>
                                    <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur text-white text-xs rounded">
                                        {room.viewerCount} viewers
                                    </div>
                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors flex items-center justify-center">
                                        <Wifi className="w-12 h-12 text-white/20" />
                                    </div>
                                </div>

                                <div className="flex gap-3">
                                    <div className="w-10 h-10 bg-purple-600/30 rounded-full flex-shrink-0 flex items-center justify-center border border-purple-500/30">
                                        <User className="w-5 h-5 text-purple-400" />
                                    </div>
                                    <div className="min-w-0">
                                        <h3 className="text-white font-semibold truncate group-hover:text-purple-400 transition-colors">
                                            {room.title}
                                        </h3>
                                        <p className="text-neutral-400 text-sm truncate mb-1">Room: {room.roomId.slice(0, 8)}...</p>
                                        <div className="flex gap-2 mt-2">
                                            {room.tags.map(tag => (
                                                <span key={tag} className="px-2 py-0.5 bg-purple-500/20 rounded-full text-[10px] text-purple-300">
                                                    {tag}
                                                </span>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                )}
            </div>

            {/* Featured / Demo Streams */}
            <div className="mb-12">
                <h2 className="text-2xl font-bold text-white mb-6">Featured Stream</h2>
                <div className="relative aspect-video bg-neutral-900 rounded-2xl overflow-hidden border border-white/5 group cursor-pointer">
                    <div className="absolute inset-0 bg-gradient-to-br from-purple-900/50 to-blue-900/50 group-hover:scale-105 transition-transform duration-700" />

                    <div className="absolute top-4 left-4 px-3 py-1 bg-red-600 text-white text-xs font-bold rounded uppercase tracking-wider">
                        Live
                    </div>

                    <div className="absolute bottom-0 left-0 right-0 p-8 bg-gradient-to-t from-black/90 via-black/50 to-transparent">
                        <div className="flex items-start gap-4">
                            <div className="w-12 h-12 bg-purple-600 rounded-full flex items-center justify-center border-2 border-white/20">
                                <User className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-3xl font-bold text-white mb-2">Building the Future of Decentralized Streaming</h1>
                                <div className="flex items-center gap-3 text-neutral-300">
                                    <span className="font-medium text-purple-400">SuiFoundation</span>
                                    <span className="w-1 h-1 bg-neutral-500 rounded-full" />
                                    <span>Just Chatting</span>
                                    <span className="w-1 h-1 bg-neutral-500 rounded-full" />
                                    <span className="text-white">1.2k viewers</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Categories / Grid */}
            <div>
                <h2 className="text-xl font-bold text-white mb-6">Live Channels</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                    {featuredStreams.map((stream) => (
                        <Link
                            key={stream.user}
                            href={`/live/stream/${stream.user}`}
                            className="group block"
                        >
                            <div className={`aspect-video rounded-xl overflow-hidden mb-3 relative ${stream.thumbnail}`}>
                                <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-600 text-white text-[10px] font-bold rounded uppercase">
                                    Live
                                </div>
                                <div className="absolute bottom-2 left-2 px-2 py-0.5 bg-black/60 backdrop-blur text-white text-xs rounded">
                                    {stream.viewers} viewers
                                </div>
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-white/10 transition-colors" />
                            </div>

                            <div className="flex gap-3">
                                <div className="w-10 h-10 bg-neutral-800 rounded-full flex-shrink-0 flex items-center justify-center">
                                    <User className="w-5 h-5 text-neutral-400" />
                                </div>
                                <div className="min-w-0">
                                    <h3 className="text-white font-semibold truncate group-hover:text-purple-400 transition-colors">
                                        {stream.title}
                                    </h3>
                                    <p className="text-neutral-400 text-sm truncate mb-1">{stream.user}</p>
                                    <p className="text-neutral-500 text-xs hover:underline cursor-pointer">{stream.game}</p>

                                    <div className="flex gap-2 mt-2">
                                        {stream.tags.map(tag => (
                                            <span key={tag} className="px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-neutral-400 hover:bg-white/10 transition-colors">
                                                {tag}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    );
}

