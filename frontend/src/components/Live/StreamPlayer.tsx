'use client';

import { useState, useRef } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize, Settings } from 'lucide-react';

interface StreamPlayerProps {
    streamUrl?: string; // For future HLS integration
    poster?: string;
}

export default function StreamPlayer({ streamUrl, poster }: StreamPlayerProps) {
    const videoRef = useRef<HTMLVideoElement>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    const togglePlay = () => {
        if (videoRef.current) {
            if (isPlaying) {
                videoRef.current.pause();
            } else {
                videoRef.current.play();
            }
            setIsPlaying(!isPlaying);
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
            {/* Video Element (Mock Source for Phase 1) */}
            <video
                ref={videoRef}
                className="w-full h-full object-cover"
                poster={poster}
                src="http://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4"
                onClick={togglePlay}
            />

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

                        <div className="flex items-center gap-2 px-2 py-1 bg-red-600 rounded text-xs font-bold text-white uppercase tracking-wider">
                            <span className="w-2 h-2 bg-white rounded-full animate-pulse" />
                            Live
                        </div>
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
