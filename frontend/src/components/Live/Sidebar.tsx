import Link from 'next/link';
import { User, Radio, LayoutDashboard, Wallet } from 'lucide-react';

export default function Sidebar() {
    const followedChannels = [
        { name: 'SuiFoundation', game: 'Just Chatting', viewers: '1.2k', live: true },
        { name: 'MystenLabs', game: 'Coding', viewers: '850', live: true },
        { name: 'WalrusProtocol', game: 'Tech Talk', viewers: '500', live: false },
    ];

    const recommendedChannels = [
        { name: 'CryptoGamer', game: 'Sui 8192', viewers: '3.4k', live: true },
        { name: 'MoveDev', game: 'Move Language', viewers: '2.1k', live: true },
        { name: 'DeFi_Wizard', game: 'Trading', viewers: '1.5k', live: true },
    ];

    return (
        <aside className="fixed left-0 top-20 bottom-0 w-64 bg-neutral-950 border-r border-white/5 overflow-y-auto hidden md:block">
            <div className="p-4">
                {/* Quick Actions */}
                <div className="space-y-2 mb-6">
                    <Link
                        href="/live/dashboard"
                        className="flex items-center gap-3 p-3 rounded-lg bg-purple-600/10 border border-purple-500/20 hover:bg-purple-600/20 transition-colors"
                    >
                        <LayoutDashboard className="w-5 h-5 text-purple-400" />
                        <span className="text-sm font-medium text-white">Dashboard</span>
                    </Link>
                    <Link
                        href="/live/profile"
                        className="flex items-center gap-3 p-3 rounded-lg bg-white/5 border border-white/10 hover:bg-white/10 transition-colors"
                    >
                        <Wallet className="w-5 h-5 text-neutral-400" />
                        <span className="text-sm font-medium text-white">Wallet & Tier</span>
                    </Link>
                </div>

                <div className="h-px bg-white/5 mb-6" />

                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                    Followed Channels
                </h3>
                <div className="space-y-2">
                    {followedChannels.map((channel) => (
                        <Link
                            key={channel.name}
                            href={`/live/stream/${channel.name}`}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                        >
                            <div className="relative">
                                <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-neutral-400" />
                                </div>
                                {channel.live && (
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 border-2 border-neutral-950 rounded-full" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm font-medium text-white truncate">{channel.name}</p>
                                    {channel.live && (
                                        <div className="flex items-center gap-1">
                                            <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                            <span className="text-xs text-neutral-400">{channel.viewers}</span>
                                        </div>
                                    )}
                                </div>
                                <p className="text-xs text-neutral-500 truncate">{channel.game}</p>
                            </div>
                        </Link>
                    ))}
                </div>

                <div className="h-px bg-white/5 my-6" />

                <h3 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-4">
                    Recommended
                </h3>
                <div className="space-y-2">
                    {recommendedChannels.map((channel) => (
                        <Link
                            key={channel.name}
                            href={`/live/stream/${channel.name}`}
                            className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                        >
                            <div className="relative">
                                <div className="w-8 h-8 bg-neutral-800 rounded-full flex items-center justify-center">
                                    <User className="w-4 h-4 text-neutral-400" />
                                </div>
                                {channel.live && (
                                    <div className="absolute -bottom-1 -right-1 w-3 h-3 bg-red-500 border-2 border-neutral-950 rounded-full" />
                                )}
                            </div>
                            <div className="flex-1 min-w-0">
                                <div className="flex justify-between items-center">
                                    <p className="text-sm font-medium text-white truncate">{channel.name}</p>
                                    <div className="flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 bg-red-500 rounded-full" />
                                        <span className="text-xs text-neutral-400">{channel.viewers}</span>
                                    </div>
                                </div>
                                <p className="text-xs text-neutral-500 truncate">{channel.game}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </aside>
    );
}
