'use client';

import { useEffect, useState } from 'react';
import { useCurrentAccount, useSuiClient } from '@mysten/dapp-kit';

// Package ID from testnet deployment
const PACKAGE_ID = process.env.NEXT_PUBLIC_TAI_PACKAGE_ID || '0x485d8011d546fd82d576b5b60bad253d22f48cf0b5e8f56876d3edebb64b9f62';

// UserProfile type name
const USER_PROFILE_TYPE = `${PACKAGE_ID}::user_profile::UserProfile`;

// Tier constants matching the contract
export const TIERS = {
    FREE: 0,
    AUDIO: 1,     // 1 SUI
    PODCAST: 2,   // 10 SUI
    VIDEO: 3,     // 50 SUI
    PREMIUM: 4,   // 100 SUI
} as const;

export const TIER_NAMES: Record<number, string> = {
    0: 'Free',
    1: 'Audio',
    2: 'Podcast',
    3: 'Video',
    4: 'Premium',
};

export interface UserProfileData {
    id: string;
    tier: number;
    tierName: string;
    stakedBalance: bigint;
    totalTipsSent: bigint;
    totalTipsReceived: bigint;
    totalPoints: bigint;
    createdAt: number;
}

interface UseUserProfileResult {
    profile: UserProfileData | null;
    isLoading: boolean;
    error: string | null;
    refetch: () => void;
}

/**
 * Hook to fetch the connected user's profile from the Sui blockchain.
 * Reads the UserProfile object owned by the connected wallet.
 */
export function useUserProfile(): UseUserProfileResult {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();

    const [profile, setProfile] = useState<UserProfileData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchProfile = async () => {
        if (!account?.address || !suiClient) {
            setProfile(null);
            return;
        }

        setIsLoading(true);
        setError(null);

        try {
            // Query all objects owned by this address of type UserProfile
            const objects = await suiClient.getOwnedObjects({
                owner: account.address,
                filter: {
                    StructType: USER_PROFILE_TYPE,
                },
                options: {
                    showContent: true,
                    showType: true,
                },
            });

            if (objects.data.length === 0) {
                // No profile found - user has not created one
                setProfile(null);
                setIsLoading(false);
                return;
            }

            // Get the first (and should be only) profile
            const profileObject = objects.data[0];

            if (profileObject.data?.content?.dataType === 'moveObject') {
                const fields = profileObject.data.content.fields as Record<string, unknown>;

                // Parse the staked_balance which is a Balance<SUI> object
                const stakedBalanceField = fields.staked_balance as { fields?: { value?: string } } | string;
                let stakedBalance: bigint = BigInt(0);

                if (typeof stakedBalanceField === 'object' && stakedBalanceField?.fields?.value) {
                    stakedBalance = BigInt(stakedBalanceField.fields.value);
                } else if (typeof stakedBalanceField === 'string') {
                    stakedBalance = BigInt(stakedBalanceField);
                }

                const tier = Number(fields.tier);

                setProfile({
                    id: profileObject.data.objectId,
                    tier,
                    tierName: TIER_NAMES[tier] || 'Unknown',
                    stakedBalance,
                    totalTipsSent: BigInt(String(fields.total_tips_sent || 0)),
                    totalTipsReceived: BigInt(String(fields.total_tips_received || 0)),
                    totalPoints: BigInt(String(fields.total_points || 0)),
                    createdAt: Number(fields.created_at || 0),
                });
            }
        } catch (err) {
            console.error('Failed to fetch user profile:', err);
            setError(err instanceof Error ? err.message : 'Failed to fetch profile');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchProfile();
    }, [account?.address, suiClient]);

    return {
        profile,
        isLoading,
        error,
        refetch: fetchProfile,
    };
}

/**
 * Helper to format staked amount in SUI
 */
export function formatStakedSui(mist: bigint): string {
    const sui = Number(mist) / 1_000_000_000;
    return sui.toFixed(2);
}

export default useUserProfile;
