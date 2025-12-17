'use client';

import { useState } from 'react';
import { Radio, Settings, Activity, Users, DollarSign, Eye, Edit3, Camera, Twitter, Globe, Zap, AlertCircle, Loader2, Mic, Video, Monitor, Crown, X, Play, Wallet } from 'lucide-react';
import { useGoLive } from '@/utils/useGoLive';
import { useUserProfile, formatStakedSui, TIER_NAMES } from '@/utils/useUserProfile';
import { useCurrentAccount } from '@mysten/dapp-kit';

// Room type options
const ROOM_TYPES = [
    { id: 'audio', name: 'Audio Only', icon: Mic, description: 'Voice chat stream', tier: 1, color: 'blue' },
    { id: 'podcast', name: 'Podcast', icon: Monitor, description: 'Audio + screen share', tier: 2, color: 'green' },
    { id: 'video', name: 'Video', icon: Video, description: 'Full video streaming', tier: 3, color: 'purple' },
    { id: 'premium', name: 'Premium', icon: Crown, description: 'Priority routing + branding', tier: 4, color: 'amber' },
];

export default function DashboardPage() {
    const account = useCurrentAccount();
    const { profile: onChainProfile, isLoading: isLoadingProfile } = useUserProfile();
    const [isEditingProfile, setIsEditingProfile] = useState(false);
    const [showGoLiveModal, setShowGoLiveModal] = useState(false);
    const [selectedRoomType, setSelectedRoomType] = useState('video');
    const [isDemoMode, setIsDemoMode] = useState(false);
    const { goLive, canStream, isLoading, error } = useGoLive();

    // Use on-chain profile if available, otherwise default to Free tier
    const tierLevel = onChainProfile?.tier ?? 0;
    const tierName = onChainProfile?.tierName ?? 'Free';
    const stakedAmount = onChainProfile ? formatStakedSui(onChainProfile.stakedBalance) : '0';

    // Mock display data (name, avatar, etc. - these would come from off-chain storage)
    const displayProfile = {
        name: 'CryptoStreamer',
        bio: 'Building the future of decentralized streaming 🚀',
        avatar: '/IMG_2262.png',
        followers: 843,
        twitter: '@cryptostreamer',
        website: 'https://tai.gg'
    };

    const handleGoLive = async () => {
        const effectiveTier = isDemoMode ? 4 : tierLevel; // Demo mode = max tier

        try {
            await goLive(effectiveTier, {
                title: `${displayProfile.name}'s Stream`,
                privacyMode: false,
                roomType: selectedRoomType as 'audio' | 'podcast' | 'video' | 'premium'
            });
            setShowGoLiveModal(false);
        } catch (err) {
            console.error('Go Live failed:', err);
        }
    };

    const isEligible = canStream(tierLevel) || isDemoMode;
    const selectedRoom = ROOM_TYPES.find(t => t.id === selectedRoomType);

    return (
        <div className="p-6 md:p-8 max-w-6xl mx-auto">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">Creator Dashboard</h1>
                    <p className="text-neutral-400">Manage your stream, analytics, and earnings.</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Demo Mode Toggle */}
                    <button
                        onClick={() => setIsDemoMode(!isDemoMode)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-2 ${isDemoMode
                            ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                            : 'bg-neutral-800 text-neutral-400 border border-white/5 hover:bg-neutral-700'
                            }`}
                    >
                        <Play className="w-4 h-4" />
                        {isDemoMode ? 'Demo ON' : 'Demo'}
                    </button>

                    <div className={`px-3 py-1 rounded-full text-sm font-medium flex items-center gap-2 bg-neutral-800 text-neutral-400 border border-white/5`}>
                        <div className="w-2 h-2 rounded-full bg-neutral-500" />
                        Offline
                    </div>
                    <button
                        onClick={() => setShowGoLiveModal(true)}
                        className="px-6 py-2 rounded-xl font-semibold transition-all flex items-center gap-2 bg-purple-600 hover:bg-purple-500 text-white shadow-lg shadow-purple-600/20"
                    >
                        Go Live
                    </button>
                </div>
            </div>

            {/* Demo Mode Banner */}
            {isDemoMode && (
                <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-start gap-3">
                    <Play className="w-5 h-5 text-emerald-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-emerald-400 font-medium">Demo Mode Active</p>
                        <p className="text-emerald-400/80 text-sm">All tiers unlocked. Staking bypassed for demonstration.</p>
                    </div>
                </div>
            )}

            {/* Error Alert */}
            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="text-red-400 font-medium">Unable to start stream</p>
                        <p className="text-red-400/80 text-sm">{error}</p>
                    </div>
                </div>
            )}

            {/* Go Live Modal */}
            {showGoLiveModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-neutral-900 border border-white/10 rounded-2xl max-w-lg w-full p-6">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-xl font-bold text-white">Start Your Stream</h2>
                            <button
                                onClick={() => setShowGoLiveModal(false)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-neutral-400" />
                            </button>
                        </div>

                        {/* Room Type Selection */}
                        <p className="text-neutral-400 text-sm mb-4">Choose your stream type:</p>
                        <div className="grid grid-cols-2 gap-3 mb-6">
                            {ROOM_TYPES.map((type) => {
                                const Icon = type.icon;
                                const isAvailable = isDemoMode || tierLevel >= type.tier;
                                const isSelected = selectedRoomType === type.id;

                                return (
                                    <button
                                        key={type.id}
                                        onClick={() => isAvailable && setSelectedRoomType(type.id)}
                                        disabled={!isAvailable}
                                        className={`p-4 rounded-xl border transition-all text-left ${isSelected
                                            ? `bg-${type.color}-500/20 border-${type.color}-500/50`
                                            : isAvailable
                                                ? 'bg-neutral-800/50 border-white/5 hover:border-white/20'
                                                : 'bg-neutral-800/30 border-white/5 opacity-50 cursor-not-allowed'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3 mb-2">
                                            <Icon className={`w-5 h-5 ${isSelected ? `text-${type.color}-400` : 'text-neutral-400'}`} />
                                            <span className={`font-medium ${isSelected ? 'text-white' : 'text-neutral-300'}`}>
                                                {type.name}
                                            </span>
                                        </div>
                                        <p className="text-neutral-500 text-xs">{type.description}</p>
                                        {!isAvailable && (
                                            <p className="text-amber-500/80 text-xs mt-2">Requires Tier {type.tier}</p>
                                        )}
                                    </button>
                                );
                            })}
                        </div>

                        {/* Privacy Option */}
                        <div className="flex items-center gap-3 mb-6 p-3 bg-neutral-800/50 rounded-xl">
                            <input
                                type="checkbox"
                                id="privacy"
                                className="w-4 h-4 rounded bg-neutral-700 border-neutral-600 text-purple-500 focus:ring-purple-500"
                            />
                            <label htmlFor="privacy" className="text-sm text-neutral-300">
                                Enable E2E encryption (Privacy Mode)
                            </label>
                        </div>

                        {/* Go Live Button */}
                        <button
                            onClick={handleGoLive}
                            disabled={isLoading}
                            className="w-full py-3 rounded-xl font-semibold bg-purple-600 hover:bg-purple-500 text-white transition-all flex items-center justify-center gap-2"
                        >
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                    Starting Stream...
                                </>
                            ) : (
                                <>
                                    <Radio className="w-5 h-5" />
                                    Go Live as {selectedRoom?.name}
                                </>
                            )}
                        </button>

                        {isDemoMode && (
                            <p className="text-center text-emerald-400/80 text-xs mt-3">
                                🎮 Demo mode: All tiers unlocked
                            </p>
                        )}
                    </div>
                </div>
            )}

            {/* Profile Card */}
            <div className="mb-8 p-6 bg-neutral-900/50 border border-white/5 rounded-2xl">
                <div className="flex flex-col md:flex-row gap-6">
                    {/* Avatar */}
                    <div className="relative group">
                        <div className="w-24 h-24 rounded-2xl overflow-hidden border-2 border-purple-500/50">
                            <img
                                src={displayProfile.avatar}
                                alt={displayProfile.name}
                                className="w-full h-full object-cover"
                            />
                        </div>
                        <button className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl">
                            <Camera className="w-6 h-6 text-white" />
                        </button>
                    </div>

                    {/* Profile Info */}
                    <div className="flex-1">
                        <div className="flex items-start justify-between gap-4">
                            <div>
                                <div className="flex items-center gap-3 mb-2">
                                    {isEditingProfile ? (
                                        <input
                                            type="text"
                                            value={displayProfile.name}
                                            readOnly
                                            className="bg-neutral-950 border border-white/10 rounded-lg px-3 py-1 text-xl font-bold text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50"
                                        />
                                    ) : (
                                        <h2 className="text-xl font-bold text-white">{displayProfile.name}</h2>
                                    )}
                                    <span className={`px-2 py-0.5 text-xs font-bold rounded-full flex items-center gap-1 ${tierLevel >= 3 ? 'bg-purple-500/20 text-purple-400' :
                                        tierLevel >= 2 ? 'bg-blue-500/20 text-blue-400' :
                                            'bg-gray-500/20 text-gray-400'
                                        }`}>
                                        <Zap className="w-3 h-3" />
                                        {tierName} ({stakedAmount} SUI)
                                    </span>
                                </div>

                                {isEditingProfile ? (
                                    <textarea
                                        value={displayProfile.bio}
                                        readOnly
                                        className="w-full bg-neutral-950 border border-white/10 rounded-lg px-3 py-2 text-sm text-neutral-300 focus:outline-none focus:ring-2 focus:ring-purple-500/50 resize-none"
                                        rows={2}
                                    />
                                ) : (
                                    <p className="text-neutral-400 text-sm mb-3">{displayProfile.bio}</p>
                                )}

                                {/* Social Links */}
                                <div className="flex items-center gap-4 mt-3">
                                    <a href={`https://twitter.com/${displayProfile.twitter.replace('@', '')}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-blue-400 transition-colors">
                                        <Twitter className="w-4 h-4" />
                                        {displayProfile.twitter}
                                    </a>
                                    <a href={displayProfile.website} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-neutral-500 hover:text-purple-400 transition-colors">
                                        <Globe className="w-4 h-4" />
                                        {displayProfile.website.replace('https://', '')}
                                    </a>
                                    <span className="text-xs text-neutral-500">
                                        <Users className="w-4 h-4 inline mr-1" />
                                        {displayProfile.followers} followers
                                    </span>
                                </div>
                            </div>

                            {/* Edit Button */}
                            <button
                                onClick={() => setIsEditingProfile(!isEditingProfile)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all flex items-center gap-2 ${isEditingProfile
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white/5 hover:bg-white/10 text-neutral-300'
                                    }`}
                            >
                                <Edit3 className="w-4 h-4" />
                                {isEditingProfile ? 'Save' : 'Edit Profile'}
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {[
                    { label: 'Total Views', value: '12.5k', change: '+12%', icon: Eye, color: 'text-blue-400', bg: 'bg-blue-400/10' },
                    { label: 'Followers', value: '843', change: '+5%', icon: Users, color: 'text-purple-400', bg: 'bg-purple-400/10' },
                    { label: 'Earnings', value: '450 TAI', change: '+8%', icon: DollarSign, color: 'text-green-400', bg: 'bg-green-400/10' },
                    { label: 'Stream Health', value: 'Excellent', change: 'Stable', icon: Activity, color: 'text-orange-400', bg: 'bg-orange-400/10' },
                ].map((stat) => (
                    <div key={stat.label} className="p-6 bg-neutral-900/50 border border-white/5 rounded-2xl">
                        <div className="flex justify-between items-start mb-4">
                            <div className={`p-3 rounded-xl ${stat.bg}`}>
                                <stat.icon className={`w-6 h-6 ${stat.color}`} />
                            </div>
                            <span className="text-xs font-medium text-green-400 bg-green-400/10 px-2 py-1 rounded-lg">
                                {stat.change}
                            </span>
                        </div>
                        <h3 className="text-2xl font-bold text-white mb-1">{stat.value}</h3>
                        <p className="text-sm text-neutral-400">{stat.label}</p>
                    </div>
                ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Stream Settings */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="p-6 bg-neutral-900/50 border border-white/5 rounded-2xl">
                        <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                            <Radio className="w-5 h-5 text-purple-400" />
                            Stream Configuration
                        </h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Stream Title</label>
                                <input
                                    type="text"
                                    defaultValue="Building the Future of Decentralized Streaming"
                                    className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-neutral-400 mb-2">Category</label>
                                <select className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all">
                                    <option>Just Chatting</option>
                                    <option>Gaming</option>
                                    <option>Coding</option>
                                    <option>Crypto</option>
                                </select>
                            </div>

                            <div className="grid md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-2">Camera</label>
                                    <select className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all">
                                        <option>FaceTime HD Camera</option>
                                        <option>External Webcam</option>
                                        <option>No Camera (Audio Only)</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-neutral-400 mb-2">Microphone</label>
                                    <select className="w-full bg-neutral-950 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:ring-2 focus:ring-purple-500/50 transition-all">
                                        <option>MacBook Pro Microphone</option>
                                        <option>External Microphone</option>
                                        <option>AirPods Pro</option>
                                    </select>
                                </div>
                            </div>

                            <div className="flex items-center gap-4 pt-2">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="w-5 h-5 rounded bg-neutral-950 border-white/10 text-purple-500 focus:ring-purple-500/50" defaultChecked />
                                    <span className="text-sm text-neutral-300">Share Screen</span>
                                </label>
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input type="checkbox" className="w-5 h-5 rounded bg-neutral-950 border-white/10 text-purple-500 focus:ring-purple-500/50" defaultChecked />
                                    <span className="text-sm text-neutral-300">Enable Chat</span>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Quick Actions / Guide */}
                <div className="space-y-6">
                    <div className="p-6 bg-gradient-to-br from-purple-900/20 to-blue-900/20 border border-purple-500/20 rounded-2xl">
                        <h3 className="text-lg font-bold text-white mb-4">Quick Start Guide</h3>
                        <ol className="space-y-4 text-sm text-neutral-300 list-decimal list-inside">
                            <li>Set your <strong>Stream Title</strong> and Category</li>
                            <li>Select your <strong>Camera</strong> and Microphone</li>
                            <li>Enable Screen Share if presenting</li>
                            <li>Click <strong>"Go Live"</strong> to start streaming!</li>
                        </ol>
                        <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-xl">
                            <p className="text-xs text-green-400">
                                ✨ <strong>P2P Streaming</strong> — Low latency, direct to viewers. No external software needed!
                            </p>
                        </div>
                    </div>

                    <div className="p-6 bg-neutral-900/50 border border-white/5 rounded-2xl">
                        <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                            <Settings className="w-5 h-5 text-neutral-400" />
                            Stream Quality
                        </h3>
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-neutral-400">Resolution</span>
                                <span className="text-white font-medium">1080p 60fps</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-neutral-400">Bitrate</span>
                                <span className="text-white font-medium">6000 Kbps</span>
                            </div>
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-neutral-400">Latency</span>
                                <span className="text-green-400 font-medium">Low (P2P)</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
