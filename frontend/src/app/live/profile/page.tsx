'use client';

import { useState } from 'react';
import { useCurrentAccount, useSuiClientQuery, useSignAndExecuteTransaction } from '@mysten/dapp-kit';
import { formatAddress, MIST_PER_SUI } from '@mysten/sui/utils';
import { Transaction } from '@mysten/sui/transactions';
import { WalletConnect, BalanceDisplay } from '@/components/Wallet';
import { PointsDisplay } from '@/components/Points';
import { Wallet, Zap, Clock, TrendingUp, Crown, Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';


// Tier definitions
const TIERS = [
    { level: 0, name: 'Watch Only', stake: 0, description: 'View streams & chat', icon: Shield, color: 'gray' },
    { level: 1, name: 'Audio Only', stake: 1, description: 'Voice-only streaming', icon: Shield, color: 'green' },
    { level: 2, name: 'Podcast', stake: 10, description: 'Audio + screen share', icon: Zap, color: 'blue' },
    { level: 3, name: 'Video', stake: 50, description: 'Full video streaming', icon: TrendingUp, color: 'purple' },
    { level: 4, name: 'Premium', stake: 100, description: 'Priority routing + branding', icon: Crown, color: 'amber' },
];

export default function ProfilePage() {
    const account = useCurrentAccount();
    const [selectedTier, setSelectedTier] = useState<number | null>(null);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    // Get SUI balance
    const { data: balance, refetch } = useSuiClientQuery(
        'getBalance',
        { owner: account?.address ?? '' },
        { enabled: !!account }
    );

    const suiBalance = balance ? Number(balance.totalBalance) / Number(MIST_PER_SUI) : 0;

    // Mock current tier (in real app, query from contract)
    const currentTierLevel = 0;
    const currentTier = TIERS[currentTierLevel];
    const stakedAmount = 0;

    const handleStake = async (tier: typeof TIERS[0]) => {
        if (!account || tier.stake === 0) return;

        setStatus('loading');
        setSelectedTier(tier.level);

        try {
            const tx = new Transaction();
            const amountInMist = BigInt(tier.stake * 1_000_000_000);

            // For MVP: Just transfer to a placeholder staking address
            // In production: Call smart contract stake function
            const STAKING_ADDRESS = '0x0000000000000000000000000000000000000000000000000000000000000001';

            const [coin] = tx.splitCoins(tx.gas, [amountInMist]);
            tx.transferObjects([coin], STAKING_ADDRESS);

            signAndExecute(
                { transaction: tx },
                {
                    onSuccess: () => {
                        setStatus('success');
                        setMessage(`Successfully staked ${tier.stake} SUI for ${tier.name} tier!`);
                        refetch();
                        setTimeout(() => {
                            setStatus('idle');
                            setSelectedTier(null);
                        }, 3000);
                    },
                    onError: (error) => {
                        setStatus('error');
                        setMessage(error.message);
                    },
                }
            );
        } catch (error: any) {
            setStatus('error');
            setMessage(error.message);
        }
    };

    if (!account) {
        return (
            <div className="min-h-[80vh] flex items-center justify-center">
                <div className="text-center">
                    <Wallet className="w-16 h-16 mx-auto mb-4 text-neutral-600" />
                    <h1 className="text-2xl font-bold text-white mb-2">Connect Your Wallet</h1>
                    <p className="text-neutral-400 mb-6">Connect to view your profile and tier</p>
                    <WalletConnect />
                </div>
            </div>
        );
    }

    return (
        <div className="p-6 md:p-8 max-w-4xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-white mb-2">Wallet & Tier</h1>
                <p className="text-neutral-400">
                    Connected as <span className="font-mono text-purple-400">{formatAddress(account.address)}</span>
                </p>
            </div>

            {/* Wallet Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                {/* SUI Balance */}
                <div className="bg-neutral-900 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                            <Wallet className="w-5 h-5 text-blue-400" />
                        </div>
                        <span className="text-neutral-400 text-sm">Available Balance</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{suiBalance.toFixed(4)} SUI</p>
                </div>

                {/* Staked */}
                <div className="bg-neutral-900 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                            <Zap className="w-5 h-5 text-purple-400" />
                        </div>
                        <span className="text-neutral-400 text-sm">Staked</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{stakedAmount} SUI</p>
                </div>

                {/* Current Tier */}
                <div className="bg-neutral-900 border border-white/10 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className={`w-10 h-10 bg-${currentTier.color}-500/20 rounded-lg flex items-center justify-center`}>
                            <currentTier.icon className={`w-5 h-5 text-${currentTier.color}-400`} />
                        </div>
                        <span className="text-neutral-400 text-sm">Current Tier</span>
                    </div>
                    <p className="text-2xl font-bold text-white">{currentTier.name}</p>
                </div>
            </div>

            {/* Status Message */}
            {status !== 'idle' && (
                <div className={`mb-6 p-4 rounded-xl flex items-center gap-3 ${status === 'loading' ? 'bg-blue-500/10 border border-blue-500/20' :
                    status === 'success' ? 'bg-green-500/10 border border-green-500/20' :
                        'bg-red-500/10 border border-red-500/20'
                    }`}>
                    {status === 'loading' && <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />}
                    {status === 'success' && <CheckCircle className="w-5 h-5 text-green-400" />}
                    {status === 'error' && <AlertCircle className="w-5 h-5 text-red-400" />}
                    <span className={`text-sm ${status === 'loading' ? 'text-blue-400' :
                        status === 'success' ? 'text-green-400' :
                            'text-red-400'
                        }`}>
                        {status === 'loading' ? 'Processing transaction...' : message}
                    </span>
                </div>
            )}

            {/* Tier Selection */}
            <div className="bg-neutral-900 border border-white/10 rounded-xl p-6">
                <h2 className="text-xl font-bold text-white mb-6">Upgrade Your Tier</h2>
                <p className="text-neutral-400 text-sm mb-6">
                    Stake SUI to unlock higher streaming tiers. Staking is refundable with a 7-day cooldown.
                </p>

                {/* First row: 4 tiers */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {TIERS.filter(t => t.level < 4).map((tier) => {
                        const isCurrentTier = tier.level === currentTierLevel;
                        const isUpgrade = tier.level > currentTierLevel;
                        const canAfford = suiBalance >= tier.stake;
                        const isProcessing = selectedTier === tier.level && status === 'loading';

                        return (
                            <div
                                key={tier.level}
                                className={`p-5 rounded-xl border-2 transition-all ${isCurrentTier
                                    ? 'border-purple-500 bg-purple-500/10'
                                    : isUpgrade
                                        ? 'border-white/10 bg-white/5 hover:border-white/20'
                                        : 'border-white/5 bg-white/[0.02] opacity-50'
                                    }`}
                            >
                                <div className={`w-12 h-12 bg-${tier.color}-500/20 rounded-xl flex items-center justify-center mb-4`}>
                                    <tier.icon className={`w-6 h-6 text-${tier.color}-400`} />
                                </div>

                                <h3 className="font-bold text-white text-lg mb-1">{tier.name}</h3>
                                <p className="text-sm text-neutral-500 mb-3">{tier.description}</p>

                                <p className="text-lg font-semibold text-white mb-4">
                                    {tier.stake === 0 ? 'Free' : `${tier.stake} SUI`}
                                </p>

                                {isCurrentTier ? (
                                    <span className="inline-block px-3 py-2 bg-purple-500/20 text-purple-400 text-sm font-medium rounded-lg">
                                        Current Tier
                                    </span>
                                ) : isUpgrade ? (
                                    <button
                                        onClick={() => handleStake(tier)}
                                        disabled={!canAfford || isProcessing}
                                        className={`w-full px-4 py-2 rounded-lg font-medium transition-all flex items-center justify-center gap-2 ${canAfford
                                            ? 'bg-purple-600 hover:bg-purple-700 text-white'
                                            : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                            }`}
                                    >
                                        {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                                        {!canAfford ? 'Insufficient SUI' : isProcessing ? 'Staking...' : tier.stake === 0 ? 'Default' : `Stake ${tier.stake} SUI`}
                                    </button>
                                ) : null}
                            </div>
                        );
                    })}
                </div>

                {/* Second row: Premium tier - full width with shiny effect */}
                {TIERS.filter(t => t.level === 4).map((tier) => {
                    const isCurrentTier = tier.level === currentTierLevel;
                    const isUpgrade = tier.level > currentTierLevel;
                    const canAfford = suiBalance >= tier.stake;
                    const isProcessing = selectedTier === tier.level && status === 'loading';

                    return (
                        <div
                            key={tier.level}
                            className={`relative overflow-hidden p-6 rounded-xl border-2 transition-all ${isCurrentTier
                                ? 'border-amber-500 bg-amber-500/10'
                                : isUpgrade
                                    ? 'border-amber-500/50 bg-gradient-to-r from-amber-500/10 via-amber-400/5 to-amber-500/10 hover:border-amber-500'
                                    : 'border-white/5 bg-white/[0.02] opacity-50'
                                }`}
                        >
                            {/* Shiny sweep effect */}
                            <div className="absolute inset-0 -translate-x-full animate-[shimmer_3s_infinite] bg-gradient-to-r from-transparent via-white/10 to-transparent" />

                            <div className="relative flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    <div className="w-14 h-14 bg-amber-500/20 rounded-xl flex items-center justify-center">
                                        <Crown className="w-8 h-8 text-amber-400" />
                                    </div>
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <h3 className="font-bold text-white text-xl">{tier.name}</h3>
                                            <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
                                                ✨ BEST VALUE
                                            </span>
                                        </div>
                                        <p className="text-neutral-400">{tier.description}</p>
                                    </div>
                                </div>

                                <div className="flex items-center gap-4">
                                    <p className="text-2xl font-bold text-amber-400">
                                        {tier.stake} SUI
                                    </p>

                                    {isCurrentTier ? (
                                        <span className="px-4 py-2 bg-amber-500/20 text-amber-400 font-medium rounded-lg">
                                            Current Tier
                                        </span>
                                    ) : isUpgrade ? (
                                        <button
                                            onClick={() => handleStake(tier)}
                                            disabled={!canAfford || isProcessing}
                                            className={`px-6 py-3 rounded-lg font-bold transition-all flex items-center gap-2 ${canAfford
                                                ? 'bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-black'
                                                : 'bg-neutral-800 text-neutral-500 cursor-not-allowed'
                                                }`}
                                        >
                                            {isProcessing && <Loader2 className="w-4 h-4 animate-spin" />}
                                            {!canAfford ? 'Insufficient SUI' : isProcessing ? 'Staking...' : 'Unlock Premium'}
                                        </button>
                                    ) : null}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Points Section */}
            <div className="mt-6">
                <PointsDisplay />
            </div>

            {/* Info Box */}
            <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                <h3 className="font-semibold text-blue-400 mb-2">💡 Tip: Try Proof of Effort!</h3>
                <p className="text-sm text-neutral-300">
                    New to streaming? Get 10 free hours/week to build your audience.
                    Hit the weekly performance bar for 6/8 weeks to graduate and keep your tier forever!
                </p>
            </div>
        </div>
    );
}

