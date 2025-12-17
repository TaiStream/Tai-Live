'use client';

import { useCurrentAccount } from '@mysten/dapp-kit';
import { Star, Zap, Eye, Gift, TrendingUp } from 'lucide-react';

interface PointsBreakdown {
    streaming: number;
    watching: number;
    tipping: number;
    predictions: number;
}

interface PointsDisplayProps {
    className?: string;
    showBreakdown?: boolean;
}

// Mock points data - in production, fetch from Nautilus indexer / smart contract
const MOCK_POINTS: PointsBreakdown = {
    streaming: 0,
    watching: 0,
    tipping: 0,
    predictions: 0
};

const POINTS_PER_ACTION = {
    streamingPerHour: 100,
    watchingPerHour: 10,
    tippingSui: 50,      // per SUI tipped
    predictionBet: 25,   // per bet
    predictionWin: 100   // bonus for winning
};

export default function PointsDisplay({ className, showBreakdown = true }: PointsDisplayProps) {
    const account = useCurrentAccount();

    // In production, query points from indexer
    const points = MOCK_POINTS;
    const totalPoints = points.streaming + points.watching + points.tipping + points.predictions;

    if (!account) {
        return null;
    }

    return (
        <div className={`bg-neutral-900 border border-white/10 rounded-xl overflow-hidden ${className}`}>
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-gradient-to-r from-amber-500/10 to-orange-500/10">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-500/20 rounded-lg flex items-center justify-center">
                            <Star className="w-4 h-4 text-amber-400" />
                        </div>
                        <span className="font-semibold text-white">Platform Points</span>
                    </div>
                    <span className="text-2xl font-bold text-amber-400">{totalPoints.toLocaleString()}</span>
                </div>
            </div>

            {/* Breakdown */}
            {showBreakdown && (
                <div className="p-4 space-y-3">
                    <PointsRow
                        icon={<Zap className="w-4 h-4 text-purple-400" />}
                        label="Streaming"
                        points={points.streaming}
                        rate={`+${POINTS_PER_ACTION.streamingPerHour}/hr`}
                    />
                    <PointsRow
                        icon={<Eye className="w-4 h-4 text-blue-400" />}
                        label="Watching"
                        points={points.watching}
                        rate={`+${POINTS_PER_ACTION.watchingPerHour}/hr`}
                    />
                    <PointsRow
                        icon={<Gift className="w-4 h-4 text-pink-400" />}
                        label="Tipping"
                        points={points.tipping}
                        rate={`+${POINTS_PER_ACTION.tippingSui}/SUI`}
                    />
                    <PointsRow
                        icon={<TrendingUp className="w-4 h-4 text-green-400" />}
                        label="Predictions"
                        points={points.predictions}
                        rate={`+${POINTS_PER_ACTION.predictionBet}/bet`}
                    />
                </div>
            )}

            {/* Info */}
            <div className="px-4 pb-4">
                <p className="text-xs text-neutral-500">
                    Earn points for platform activity. Points qualify you for future rewards and airdrops.
                </p>
            </div>
        </div>
    );
}

function PointsRow({ icon, label, points, rate }: { icon: React.ReactNode, label: string, points: number, rate: string }) {
    return (
        <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
                {icon}
                <span className="text-sm text-neutral-300">{label}</span>
            </div>
            <div className="flex items-center gap-3">
                <span className="text-xs text-neutral-500">{rate}</span>
                <span className="text-sm font-medium text-white">{points.toLocaleString()}</span>
            </div>
        </div>
    );
}
