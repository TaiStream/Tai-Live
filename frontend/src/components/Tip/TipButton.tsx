'use client';

import { useState } from 'react';
import { useCurrentAccount, useSignAndExecuteTransaction, useSuiClient } from '@mysten/dapp-kit';
import { Transaction } from '@mysten/sui/transactions';
import { Heart, Loader2, CheckCircle } from 'lucide-react';

interface TipButtonProps {
    recipientAddress: string;
    recipientName?: string;
    className?: string;
}

const TIP_AMOUNTS = [
    { amount: 0.1, label: '0.1 SUI' },
    { amount: 0.5, label: '0.5 SUI' },
    { amount: 1, label: '1 SUI' },
    { amount: 5, label: '5 SUI' },
];

export default function TipButton({ recipientAddress, recipientName = 'Streamer', className }: TipButtonProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [selectedAmount, setSelectedAmount] = useState(TIP_AMOUNTS[0].amount);
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const { mutate: signAndExecute } = useSignAndExecuteTransaction();

    const handleTip = async () => {
        if (!account) return;

        setStatus('loading');

        try {
            const tx = new Transaction();

            // Convert SUI to MIST (1 SUI = 1e9 MIST)
            const amountInMist = BigInt(selectedAmount * 1_000_000_000);

            // Split coins from gas and transfer to recipient
            const [coin] = tx.splitCoins(tx.gas, [amountInMist]);
            tx.transferObjects([coin], recipientAddress);

            signAndExecute(
                { transaction: tx },
                {
                    onSuccess: (result) => {
                        console.log('Tip sent!', result);
                        setStatus('success');
                        setTimeout(() => {
                            setStatus('idle');
                            setIsOpen(false);
                        }, 2000);
                    },
                    onError: (error) => {
                        console.error('Tip failed:', error);
                        setStatus('error');
                        setMessage(error.message);
                    },
                }
            );
        } catch (error: any) {
            console.error('Tip failed:', error);
            setStatus('error');
            setMessage(error.message);
        }
    };

    if (!account) {
        return null;
    }

    return (
        <div className={`relative ${className}`}>
            {/* Main Tip Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 text-white font-semibold rounded-lg transition-all shadow-lg shadow-pink-500/25 hover:shadow-pink-500/40"
            >
                <Heart className="w-4 h-4" />
                <span>Tip</span>
            </button>

            {/* Tip Modal */}
            {isOpen && (
                <div className="absolute bottom-full mb-2 right-0 w-64 bg-neutral-900 border border-white/10 rounded-xl p-4 shadow-2xl">
                    {/* Header */}
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-semibold text-white">Send a Tip</h3>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="text-neutral-400 hover:text-white"
                        >
                            ×
                        </button>
                    </div>

                    {/* Amount Selection */}
                    <div className="grid grid-cols-2 gap-2 mb-4">
                        {TIP_AMOUNTS.map((tip) => (
                            <button
                                key={tip.amount}
                                onClick={() => setSelectedAmount(tip.amount)}
                                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedAmount === tip.amount
                                        ? 'bg-pink-500 text-white'
                                        : 'bg-white/5 text-neutral-300 hover:bg-white/10'
                                    }`}
                            >
                                {tip.label}
                            </button>
                        ))}
                    </div>

                    {/* Send Button */}
                    <button
                        onClick={handleTip}
                        disabled={status === 'loading'}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 disabled:opacity-50 text-white font-semibold rounded-lg transition-all"
                    >
                        {status === 'loading' && <Loader2 className="w-4 h-4 animate-spin" />}
                        {status === 'success' && <CheckCircle className="w-4 h-4" />}
                        {status === 'loading' ? 'Sending...' : status === 'success' ? 'Sent!' : `Send ${selectedAmount} SUI`}
                    </button>

                    {/* Error Message */}
                    {status === 'error' && (
                        <p className="mt-2 text-xs text-red-400">{message}</p>
                    )}

                    {/* Recipient Info */}
                    <p className="mt-3 text-xs text-neutral-500 text-center">
                        Tipping {recipientName}
                    </p>
                </div>
            )}
        </div>
    );
}
