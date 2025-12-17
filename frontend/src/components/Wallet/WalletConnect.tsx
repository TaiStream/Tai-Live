'use client';

import { ConnectButton, useCurrentAccount, useDisconnectWallet } from '@mysten/dapp-kit';
import { formatAddress } from '@mysten/sui/utils';

interface WalletConnectProps {
    className?: string;
}

export default function WalletConnect({ className }: WalletConnectProps) {
    const currentAccount = useCurrentAccount();
    const { mutate: disconnect } = useDisconnectWallet();

    if (!currentAccount) {
        return (
            <ConnectButton
                className={`px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-lg transition-colors ${className}`}
            />
        );
    }

    return (
        <div className={`flex items-center gap-3 ${className}`}>
            {/* Connected Account Info */}
            <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-lg border border-white/10">
                {/* Green indicator */}
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />

                {/* Address */}
                <span className="text-sm font-mono text-neutral-300">
                    {formatAddress(currentAccount.address)}
                </span>
            </div>

            {/* Disconnect Button */}
            <button
                onClick={() => disconnect()}
                className="px-3 py-2 text-sm text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
            >
                Disconnect
            </button>
        </div>
    );
}
