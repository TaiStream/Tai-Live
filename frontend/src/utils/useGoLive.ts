'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// Package ID from testnet deployment
const PACKAGE_ID = process.env.NEXT_PUBLIC_TAI_PACKAGE_ID || '0x485d8011d546fd82d576b5b60bad253d22f48cf0b5e8f56876d3edebb64b9f62';

// Tier requirements
const TIER_AUDIO = 1;

interface GoLiveOptions {
    title?: string;
    privacyMode?: boolean;
    roomType?: 'audio' | 'podcast' | 'video' | 'premium';
}

interface GoLiveState {
    isLoading: boolean;
    error: string | null;
}

/**
 * Hook for managing the Go Live flow.
 * Checks tier eligibility and creates a streaming room.
 */
export function useGoLive() {
    const router = useRouter();
    const [state, setState] = useState<GoLiveState>({
        isLoading: false,
        error: null,
    });

    /**
     * Start a live stream.
     * For MVP: Creates a local room ID and redirects to P2P room.
     * Future: Will integrate with wallet and room_manager contract.
     */
    const goLive = useCallback(async (tier: number, options: GoLiveOptions = {}) => {
        setState({ isLoading: true, error: null });

        try {
            // 1. Check tier eligibility
            if (tier < TIER_AUDIO) {
                throw new Error('You need to stake at least 1 SUI to unlock streaming. Go to your profile to stake.');
            }

            // 2. Generate room ID (in future: create on contract)
            const roomId = generateRoomId();

            // 3. Store room metadata
            console.log('Creating room:', {
                roomId,
                title: options.title || 'Live Stream',
                privacyMode: options.privacyMode || false,
                roomType: options.roomType || 'video',
                packageId: PACKAGE_ID,
            });

            // 4. Redirect to broadcast page with room type
            const params = new URLSearchParams();
            if (options.privacyMode) params.set('privacy', 'true');
            if (options.roomType) params.set('type', options.roomType);
            const queryString = params.toString();
            router.push(`/live/broadcast/${roomId}${queryString ? '?' + queryString : ''}`);

            setState({ isLoading: false, error: null });
            return roomId;
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Failed to start stream';
            setState({ isLoading: false, error: message });
            throw error;
        }
    }, [router]);

    /**
     * Check if a user tier is eligible for streaming
     */
    const canStream = useCallback((tier: number): boolean => {
        return tier >= TIER_AUDIO;
    }, []);

    return {
        goLive,
        canStream,
        isLoading: state.isLoading,
        error: state.error,
    };
}

/**
 * Generate a unique room ID
 */
function generateRoomId(): string {
    // Use crypto for better randomness
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    // Fallback for older browsers
    return 'room-' + Date.now().toString(36) + '-' + Math.random().toString(36).substr(2, 9);
}

export default useGoLive;
