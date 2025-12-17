import React, { useState, useRef, useEffect } from 'react';

export type ChatMessage = {
    id: string;
    senderId: string;
    timestamp: number;
    type: 'text' | 'image' | 'file' | 'audio' | 'location';
    content: string; // Text content or Data URL / Blob URL
    metadata?: {
        fileName?: string;
        fileSize?: number;
        mimeType?: string;
        coordinates?: { lat: number, lng: number };
        duration?: number;
    };
};

interface ChatSidebarProps {
    isOpen: boolean;
    onClose: () => void;
    messages: ChatMessage[];
    onSendMessage: (text: string) => void;
    onSendFile: (file: File) => void;
    onSendLocation: () => void;
    myPeerId: string;
}

export default function ChatSidebar({
    isOpen,
    onClose,
    messages,
    onSendMessage,
    onSendFile,
    onSendLocation,
    myPeerId
}: ChatSidebarProps) {
    const [inputText, setInputText] = useState('');
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (inputText.trim()) {
            onSendMessage(inputText);
            setInputText('');
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onSendFile(e.target.files[0]);
        }
    };

    const formatTime = (timestamp: number) => {
        return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    };

    if (!isOpen) return null;

    return (
        <div className="fixed right-0 top-0 bottom-0 w-80 bg-neutral-900 border-l border-white/10 flex flex-col shadow-2xl z-50 transition-transform duration-300">
            {/* Header */}
            <div className="p-4 border-b border-white/10 flex justify-between items-center bg-neutral-900/50 backdrop-blur">
                <h2 className="text-lg font-semibold text-white">Chat</h2>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/10 rounded-full transition-colors text-neutral-400 hover:text-white"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && (
                    <div className="text-center text-neutral-500 mt-10">
                        <p>No messages yet.</p>
                        <p className="text-sm">Start the conversation!</p>
                    </div>
                )}

                {messages.map((msg) => {
                    const isMe = msg.senderId === myPeerId;
                    return (
                        <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            <div className={`max-w-[85%] rounded-2xl px-4 py-2 ${isMe
                                    ? 'bg-blue-600 text-white rounded-br-none'
                                    : 'bg-neutral-800 text-neutral-200 rounded-bl-none'
                                }`}>
                                {/* Text Message */}
                                {msg.type === 'text' && <p className="break-words">{msg.content}</p>}

                                {/* Image Message */}
                                {msg.type === 'image' && (
                                    <div className="mt-1">
                                        <img
                                            src={msg.content}
                                            alt={msg.metadata?.fileName || 'Image'}
                                            className="rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90"
                                            onClick={() => window.open(msg.content, '_blank')}
                                        />
                                    </div>
                                )}

                                {/* File Message */}
                                {msg.type === 'file' && (
                                    <div className="flex items-center gap-3 p-1">
                                        <div className="bg-white/10 p-2 rounded-lg">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-medium truncate">{msg.metadata?.fileName || 'File'}</p>
                                            <p className="text-xs opacity-70">{formatFileSize(msg.metadata?.fileSize)}</p>
                                        </div>
                                        <a
                                            href={msg.content}
                                            download={msg.metadata?.fileName || 'download'}
                                            className="p-2 hover:bg-white/20 rounded-full transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                                        </a>
                                    </div>
                                )}

                                {/* Location Message */}
                                {msg.type === 'location' && msg.metadata?.coordinates && (
                                    <div className="flex flex-col gap-2">
                                        <div className="flex items-center gap-2">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                                            <span className="font-medium">Shared Location</span>
                                        </div>
                                        <a
                                            href={`https://www.google.com/maps?q=${msg.metadata.coordinates.lat},${msg.metadata.coordinates.lng}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs underline opacity-80 hover:opacity-100"
                                        >
                                            View on Maps
                                        </a>
                                    </div>
                                )}
                            </div>
                            <span className="text-[10px] text-neutral-500 mt-1 px-1">
                                {formatTime(msg.timestamp)}
                            </span>
                        </div>
                    );
                })}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-white/10 bg-neutral-900">
                <form onSubmit={handleSubmit} className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Send File"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                    </button>
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        className="hidden"
                    />

                    <button
                        type="button"
                        onClick={onSendLocation}
                        className="p-2 text-neutral-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                        title="Share Location"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                    </button>

                    <input
                        type="text"
                        value={inputText}
                        onChange={(e) => setInputText(e.target.value)}
                        placeholder="Type a message..."
                        className="flex-1 bg-neutral-800 text-white rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />

                    <button
                        type="submit"
                        disabled={!inputText.trim()}
                        className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                    </button>
                </form>
            </div>
        </div>
    );
}
