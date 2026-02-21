'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings, WifiOff } from 'lucide-react';

interface StreamPlayerProps {
    stream?: MediaStream | null; // P2P MediaStream
    streamUrl?: string; // Fallback HLS/VOD URL
    poster?: string;
    isLive?: boolean;
}

export default function StreamPlayer({ stream, streamUrl, poster, isLive = true }: StreamPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(true); // Start muted for autoplay
    const [hasStream, setHasStream] = useState(false);

    // Handle P2P MediaStream
    useEffect(() => {
        if (stream && videoRef.current) {
            videoRef.current.srcObject = stream;
            videoRef.current.play().then(() => {
                setIsPlaying(true);
                setHasStream(true);
            }).catch(err => {
                console.error('Autoplay failed:', err);
            });
        } else if (!stream) {
            setHasStream(false);
        }
    }, [stream]);

    // Handle Relay WebSocket Stream (MSE)
    useEffect(() => {
        if (!stream && streamUrl && streamUrl.startsWith('ws')) {
            const mediaSource = new MediaSource();
            if (videoRef.current) {
                videoRef.current.src = URL.createObjectURL(mediaSource);
            }

            const handleSourceOpen = () => {
                // Assuming WebM/VP8 from Chrome MediaRecorder for MVP
                // In production, we'd need to negotiate codecs
                const mime = 'video/webm; codecs="vp8, opus"';

                if (MediaSource.isTypeSupported(mime)) {
                    const sourceBuffer = mediaSource.addSourceBuffer(mime);
                    const ws = new WebSocket(streamUrl);

                    ws.binaryType = 'arraybuffer';
                    const queue: BufferSource[] = [];

                    ws.onopen = () => {
                        console.log('Connected to Relay Stream');
                        // Join as viewer
                        ws.send(JSON.stringify({
                            type: 'join_stream',
                            streamId: 'default-room', // TODO: Pass from props
                            peerId: `viewer-${Date.now()}`
                        }));
                    };

                    ws.onmessage = (event) => {
                        if (typeof event.data !== 'string') {
                            if (!sourceBuffer.updating) {
                                sourceBuffer.appendBuffer(event.data);
                            } else {
                                queue.push(event.data);
                            }
                        }
                    };

                    sourceBuffer.addEventListener('updateend', () => {
                        if (queue.length > 0 && !sourceBuffer.updating) {
                            sourceBuffer.appendBuffer(queue.shift()!);
                        }
                    });

                    ws.onclose = () => console.log('Relay Stream Disconnected');

                    setHasStream(true);
                    setIsPlaying(true);

                    return () => {
                        ws.close();
                    };
                } else {
                    console.error('MIME type not supported:', mime);
                }
            };

            mediaSource.addEventListener('sourceopen', handleSourceOpen);

            return () => {
                mediaSource.removeEventListener('sourceopen', handleSourceOpen);
            };
        }
    }, [stream, streamUrl]);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
                setIsPlaying(false);
            } else {
                videoRef.current.play();
                setIsPlaying(true);
            }
        }
    };

    const toggleMute = () => {
        if (videoRef.current) {
            videoRef.current.muted = !isMuted;
            setIsMuted(!isMuted);
        }
    };

    const toggleFullscreen = () => {
        if (videoRef.current) {
            if (document.fullscreenElement) {
                document.exitFullscreen();
            } else {
                videoRef.current.parentElement?.requestFullscreen();
            }
        }
    };

    return (
        <div className="relative aspect-video bg-black rounded-xl overflow-hidden group">
            {/* Video Element */}
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                poster={poster}
                src={!stream && !streamUrl?.startsWith('ws') ? streamUrl : undefined}
                onClick={togglePlay}
                muted={isMuted}
                playsInline
                autoPlay
            />

            {/* No Stream Placeholder */}
            {!hasStream && !streamUrl && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-neutral-900">
                    <WifiOff className="w-16 h-16 text-neutral-600 mb-4" />
                    <p className="text-neutral-500 text-lg">Waiting for stream...</p>
                    <p className="text-neutral-600 text-sm mt-2">Connecting to broadcaster</p>
                </div>
            )}

            {/* Overlay Controls */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <button onClick={togglePlay} className="text-white hover:text-purple-400 transition-colors">
                            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
                        </button>

                        <div className="flex items-center gap-2 group/vol">
                            <button onClick={toggleMute} className="text-white hover:text-purple-400 transition-colors">
                                {isMuted ? <VolumeX className="w-6 h-6" /> : <Volume2 className="w-6 h-6" />}
                            </button>
                            <div className="w-0 overflow-hidden group-hover/vol:w-24 transition-all duration-300">
                                <input type="range" className="w-20 h-1 bg-white/20 rounded-full accent-purple-500" />
                            </div>
                        </div>

                        {isLive && hasStream && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase tracking-wider">
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                Live
                            </div>
                        )}

                        {!hasStream && (
                            <div className="flex items-center gap-2 px-2 py-1 bg-neutral-700 rounded text-xs font-bold text-neutral-300 uppercase tracking-wider">
                                <span className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                                Connecting
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-4">
                        <button className="text-white hover:text-purple-400 transition-colors">
                            <Settings className="w-5 h-5" />
                        </button>
                        <button onClick={toggleFullscreen} className="text-white hover:text-purple-400 transition-colors">
                            <Maximize className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

