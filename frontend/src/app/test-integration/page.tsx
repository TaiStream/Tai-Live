'use client';

import { useState } from 'react';
import StreamPlayer from '@/components/Live/StreamPlayer';
import { NODE_URL } from '@/utils/config';

export default function IntegrationTestPage() {
    // Default to the manifest we created earlier for testing
    const [manifestId, setManifestId] = useState('3CAVF4szjfp0wr9E6fgzmN3u-rozFJ32pXbUiB55p8Y');
    const [isPlaying, setIsPlaying] = useState(false);

    return (
        <div className="min-h-screen bg-neutral-950 text-white p-8">
            <h1 className="text-3xl font-bold mb-4">Tai Network Integration Test</h1>
            <p className="text-neutral-400 mb-8">
                This page tests the integration between <strong>Tai Live (Next.js)</strong> and the <strong>Tai Node (Express)</strong>.
            </p>

            <div className="max-w-2xl mx-auto space-y-6">
                <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800">
                    <label className="block text-sm font-medium text-neutral-400 mb-2">
                        Walrus Manifest ID
                    </label>
                    <div className="flex gap-4">
                        <input
                            type="text"
                            value={manifestId}
                            onChange={(e) => setManifestId(e.target.value)}
                            className="flex-1 bg-black border border-neutral-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-cyan-500"
                        />
                        <button
                            onClick={() => setIsPlaying(true)}
                            className="bg-cyan-500 hover:bg-cyan-400 text-black font-bold py-2 px-6 rounded-lg transition-colors"
                        >
                            Play
                        </button>
                    </div>
                </div>

                {isPlaying && (
                    <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800">
                        <h2 className="text-xl font-semibold mb-4 text-cyan-400">Streaming via Node: {NODE_URL}</h2>
                        <StreamPlayer
                            streamUrl={`${NODE_URL}/stream/${manifestId}`}
                            isLive={false}
                        />
                        <div className="mt-4 p-4 bg-black rounded text-xs text-green-400 font-mono">
                            Requesting: GET {NODE_URL}/stream/{manifestId}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
