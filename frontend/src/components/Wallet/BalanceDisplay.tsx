'use client';

import { useCurrentAccount, useSuiClientQuery } from '@mysten/dapp-kit';
import { MIST_PER_SUI } from '@mysten/sui/utils';

interface BalanceDisplayProps {
    showSui?: boolean;
    showUsd?: boolean;
    className?: string;
}

// USDC on Sui (testnet)
const USDC_TYPE = '0x2::coin::Coin<0xUSERPLACEHOLDER::usdc::USDC>';

export default function BalanceDisplay({ showSui = true, showUsd = true, className }: BalanceDisplayProps) {
    const account = useCurrentAccount();

    // Get SUI balance
    const { data: suiBalance, isLoading: suiLoading } = useSuiClientQuery(
        'getBalance',
        { owner: account?.address ?? '' },
        { enabled: !!account }
    );

    // Format SUI balance
    const formatSui = (balance: string | undefined) => {
        if (!balance) return '0.00';
        const sui = Number(balance) / Number(MIST_PER_SUI);
        return sui.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    };

    // Format USD (1 USDC = $1)
    const formatUsd = (balance: string | undefined) => {
        if (!balance) return '$0.00';
        // USDC has 6 decimals
        const usd = Number(balance) / 1_000_000;
        return `$${usd.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    if (!account) {
        return null;
    }

    return (
        <div className={`flex items-center gap-4 ${className}`}>
            {/* SUI Balance */}
            {showSui && (
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-500/10 rounded-lg border border-blue-500/20">
                    <div className="w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">S</span>
                    </div>
                    <span className="text-sm font-medium text-white">
                        {suiLoading ? '...' : formatSui(suiBalance?.totalBalance)}
                    </span>
                    <span className="text-xs text-neutral-400">SUI</span>
                </div>
            )}

            {/* USD Balance (In-App) */}
            {showUsd && (
                <div className="flex items-center gap-2 px-3 py-2 bg-green-500/10 rounded-lg border border-green-500/20">
                    <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-white">$</span>
                    </div>
                    <span className="text-sm font-medium text-white">
                        $0.00
                    </span>
                    <span className="text-xs text-neutral-400">USD</span>
                </div>
            )}
        </div>
    );
}
