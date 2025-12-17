'use client';

import { useState, useRef, useEffect } from 'react';
import { Send, Smile, MoreVertical, Users, Coins } from 'lucide-react';
import { subscribeToPackageEvents, TAI_EVENTS, SurfluxEvent } from '@/utils/surfluxClient';

interface Message {
    id: string;
    user: string;
    color: string;
    text: string;
    timestamp: number;
    isTipAlert?: boolean;
    tipAmount?: string;
}

// Environment config
const SURFLUX_API_KEY = process.env.NEXT_PUBLIC_SURFLUX_API_KEY;
const TAI_PACKAGE_ID = process.env.NEXT_PUBLIC_TAI_PACKAGE_ID;

export default function LiveChat() {
    const [messages, setMessages] = useState<Message[]>([
        { id: '1', user: 'SuiFan99', color: '#a855f7', text: 'This stream is amazing! 🚀', timestamp: Date.now() - 60000 },
        { id: '2', user: 'MoveBuilder', color: '#3b82f6', text: 'Can you explain the object model again?', timestamp: Date.now() - 45000 },
        { id: '3', user: 'CryptoWhale', color: '#22c55e', text: 'Just staked 5000 TAI!', timestamp: Date.now() - 30000 },
    ]);
    const [inputText, setInputText] = useState('');
    const [tipAlert, setTipAlert] = useState<{ user: string; amount: string } | null>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Subscribe to real-time tip events via Surflux
    useEffect(() => {
        if (!SURFLUX_API_KEY || !TAI_PACKAGE_ID) {
            console.log('Surflux not configured, skipping real-time events');
            return;
        }

        const unsubscribe = subscribeToPackageEvents({
            apiKey: SURFLUX_API_KEY,
            network: 'testnet',
            packageId: TAI_PACKAGE_ID,
            eventType: 'TipSent',
            onEvent: (event: SurfluxEvent) => {
                const { sender, amount } = event.parsedJson;
                const amountSui = (Number(amount) / 1_000_000_000).toFixed(2);

                // Show animated tip alert
                setTipAlert({ user: sender.slice(0, 8), amount: amountSui });
                setTimeout(() => setTipAlert(null), 4000);

                // Add tip message to chat
                const tipMessage: Message = {
                    id: event.id,
                    user: '🎉 TIP',
                    color: '#fbbf24',
                    text: `${sender.slice(0, 8)}... tipped ${amountSui} SUI!`,
                    timestamp: event.timestampMs,
                    isTipAlert: true,
                    tipAmount: amountSui,
                };
                setMessages(prev => [...prev, tipMessage]);
            },
            onError: (error) => console.error('Surflux error:', error),
        });

        return unsubscribe;
    }, []);

    const handleSendMessage = (e: React.FormEvent) => {
        e.preventDefault();
        if (!inputText.trim()) return;

        const newMessage: Message = {
            id: Date.now().toString(),
            user: 'You',
            color: '#ef4444', // Red for current user
            text: inputText,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, newMessage]);
        setInputText('');
    };

    return (
        <div className="flex flex-col h-full bg-neutral-900 border-l border-white/5">
            {/* Header */}
            <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-neutral-900">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <ArrowRightFromLine className="w-4 h-4 rotate-180" />
                    Stream Chat
                </div>
                <div className="flex items-center gap-3 text-neutral-400">
                    <Users className="w-4 h-4" />
                    <span className="text-xs">1.2k</span>
                    <MoreVertical className="w-4 h-4 cursor-pointer hover:text-white" />
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-thin scrollbar-thumb-neutral-700 scrollbar-track-transparent">
                {messages.map((msg) => (
                    <div key={msg.id} className="text-sm break-words leading-relaxed animate-fade-in">
                        <span className="font-bold mr-2 hover:underline cursor-pointer" style={{ color: msg.color }}>
                            {msg.user}:
                        </span>
                        <span className="text-neutral-200">{msg.text}</span>
                    </div>
                ))}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/5 bg-neutral-900">
                <form onSubmit={handleSendMessage} className="relative">
                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Send a message..."
                        className="w-full bg-neutral-800 text-white rounded-xl pl-4 pr-12 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/50 placeholder:text-neutral-500"
                    />
                    <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                        <button type="button" className="p-1.5 text-neutral-400 hover:text-white transition-colors">
                            <Smile className="w-4 h-4" />
                        </button>
                        <button
                            type="submit"
                            disabled={!inputText.trim()}
                            className="p-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 disabled:bg-transparent disabled:text-neutral-500 transition-all"
                        >
                            <Send className="w-4 h-4" />
                        </button>
                    </div>
                </form>
                <div className="flex justify-between items-center mt-2 px-1">
                    <div className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-green-500 rounded-full" />
                        <span className="text-xs text-green-500 font-medium">Connected</span>
                    </div>
                    <button className="text-xs text-purple-400 hover:text-purple-300 font-medium">
                        Get Bits
                    </button>
                </div>
            </div>
        </div>
    );
}

function ArrowRightFromLine({ className }: { className?: string }) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}><path d="M3 5v14" /><path d="M21 12H7" /><path d="m15 5-7 7 7 7" /></svg>
    );
}
