/// Module: user_profile
/// User identity, staking tiers, and profile management
module tai::user_profile {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::vec_map::{Self, VecMap};
    use std::option::{Self, Option};

    // ========== Error Codes ==========
    #[allow(unused_const)]
    const EInsufficientStake: u64 = 0;
    #[allow(unused_const)]
    const EAlreadyHasProfile: u64 = 1;
    const ENoStakedBalance: u64 = 2;
    #[allow(unused_const)]
    const ENotOwner: u64 = 3;
    const ENotEligibleForFame: u64 = 4;
    const ENotEligibleForEffort: u64 = 5;
    const EHasStakedBalance: u64 = 6;
    const ENotSubjectToRevocation: u64 = 7;

    // ========== Revocation Constants ==========
    const INACTIVITY_WEEKS_THRESHOLD: u64 = 4; // 4 consecutive failing weeks = revoke
    const GRADUATION_WEEKS_THRESHOLD: u64 = 6; // 6 passing weeks = graduate

    // ========== Tier Constants (in MIST, 1 SUI = 1e9 MIST) ==========
    const TIER_FREE: u8 = 0;
    const TIER_AUDIO: u8 = 1;
    const TIER_PODCAST: u8 = 2;
    const TIER_VIDEO: u8 = 3;
    const TIER_PREMIUM: u8 = 4;

    const STAKE_AUDIO: u64 = 1_000_000_000;       // 1 SUI
    const STAKE_PODCAST: u64 = 10_000_000_000;     // 10 SUI
    const STAKE_VIDEO: u64 = 50_000_000_000;      // 50 SUI
    const STAKE_PREMIUM: u64 = 100_000_000_000;  // 100 SUI

    // ========== Access Methods ==========
    const ACCESS_STAKED: u8 = 0;
    const ACCESS_FAME: u8 = 1;
    const ACCESS_EFFORT: u8 = 2;
    const ACCESS_GRADUATED: u8 = 3;

    // ========== Proof Status ==========
    const STATUS_TRIAL: u8 = 0;
    const STATUS_GRADUATED: u8 = 1;
    const STATUS_REVOKED: u8 = 2;

    // ========== Structs ==========

    /// Admin capability for backend services (Enoki/Nautilus verification)
    public struct AdminCap has key, store { id: UID }

    /// Tier Access Configuration
    public struct TierAccess has store, drop {
        tier: u8,
        access_method: u8,
        proof_data: Option<ProofData>
    }

    /// Proof Data for Fame/Effort tracks
    public struct ProofData has store, drop {
        granted_at: u64,
        expires_at: u64,
        weekly_metrics: VecMap<u64, WeeklyMetrics>,
        status: u8
    }

    /// Weekly performance metrics for trials
    public struct WeeklyMetrics has store, copy, drop {
        hours_streamed: u64,
        avg_viewers: u64,
        engagement_rate: u64, // Basis points: 2500 = 25%
        bar_met: bool
    }

    /// User profile NFT - owned by user
    public struct UserProfile has key, store {
        id: UID,
        tier_access: TierAccess, // Updated from simple 'tier' field
        staked_balance: Balance<SUI>,
        effort_quota_minutes: u64, // Remaining trial quota
        total_tips_sent: u64,
        total_tips_received: u64,
        total_points: u64,
        created_at: u64,
    }

    // ========== Events ==========

    public struct ProfileCreated has copy, drop {
        profile_id: ID,
        owner: address,
        timestamp: u64,
    }

    public struct TierUpdated has copy, drop {
        profile_id: ID,
        old_tier: u8,
        new_tier: u8,
        method: u8,
        status: u8
    }

    public struct TrialStarted has copy, drop {
        profile_id: ID,
        method: u8, // FAME or EFFORT
        tier: u8,
        expires_at: u64
    }

    public struct MetricsRecorded has copy, drop {
        profile_id: ID,
        week: u64,
        bar_met: bool
    }

    public struct Graduated has copy, drop {
        profile_id: ID,
        method: u8,
        final_tier: u8
    }

    public struct Unstaked has copy, drop {
        profile_id: ID,
        amount: u64,
        new_tier: u8,
    }

    public struct RevokedForInactivity has copy, drop {
        profile_id: ID,
        previous_tier: u8,
        reason: u8  // 0 = unstake_no_engagement, 1 = inactivity_check
    }

    // ========== Init ==========

    fun init(ctx: &mut TxContext) {
        let admin_cap = AdminCap { id: object::new(ctx) };
        transfer::public_transfer(admin_cap, tx_context::sender(ctx));
    }

    // ========== Public Functions ==========

    /// Create a new user profile (FREE tier)
    public fun create_profile(clock: &Clock, ctx: &mut TxContext): UserProfile {
        let profile = UserProfile {
            id: object::new(ctx),
            tier_access: TierAccess {
                tier: TIER_FREE,
                access_method: ACCESS_STAKED, // Default is essentially 0 stake
                proof_data: option::none()
            },
            staked_balance: balance::zero(),
            effort_quota_minutes: 0,
            total_tips_sent: 0,
            total_tips_received: 0,
            total_points: 0,
            created_at: clock::timestamp_ms(clock),
        };

        event::emit(ProfileCreated {
            profile_id: object::id(&profile),
            owner: tx_context::sender(ctx),
            timestamp: clock::timestamp_ms(clock),
        });

        profile
    }

    /// Stake SUI to upgrade tier (Traditional Path)
    public fun stake_for_tier(
        profile: &mut UserProfile,
        payment: Coin<SUI>,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        let amount = coin::value(&payment);
        let old_tier = profile.tier_access.tier;

        // Add to staked balance
        let coin_balance = coin::into_balance(payment);
        balance::join(&mut profile.staked_balance, coin_balance);

        // Update tier based on total stake
        let total_staked = balance::value(&profile.staked_balance);
        let new_tier = calculate_stake_tier(total_staked);

        // Access method remains STAKED if it upgrades via stake
        // However, if they are on a TRIAL, staking might override or coexist.
        // For simplicity: If new stake tier > current tier, switch to STAKED access.
        if (new_tier > profile.tier_access.tier) {
            profile.tier_access.tier = new_tier;
            profile.tier_access.access_method = ACCESS_STAKED;
            
            event::emit(TierUpdated {
                profile_id: object::id(profile),
                old_tier,
                new_tier,
                method: ACCESS_STAKED,
                status: STATUS_GRADUATED // Staking is permanent/valid immediately
            });
        };
        
        // Always emit an event for the stake deposit? Maybe just TierUpdated if relevant.
    }

    /// Grant Proof of Fame tier (Admin Only)
    /// Called by backend after verifying Twitch/YouTube credentials
    public fun grant_proof_of_fame(
        _: &AdminCap,
        profile: &mut UserProfile,
        target_tier: u8,
        clock: &Clock
    ) {
        assert!(target_tier >= TIER_PODCAST, ENotEligibleForFame); // Fame starts from Podcast
        
        let _old_tier = profile.tier_access.tier;
        let now = clock::timestamp_ms(clock);
        
        profile.tier_access = TierAccess {
            tier: target_tier,
            access_method: ACCESS_FAME,
            proof_data: option::some(ProofData {
                granted_at: now,
                expires_at: now + (60 * 24 * 60 * 60 * 1000), // 60 days
                weekly_metrics: vec_map::empty(),
                status: STATUS_TRIAL
            })
        };

        event::emit(TrialStarted {
            profile_id: object::id(profile),
            method: ACCESS_FAME,
            tier: target_tier,
            expires_at: now + (60 * 24 * 60 * 60 * 1000)
        });
    }

    /// Start Proof of Effort trial (Self-Serve)
    /// Gives new streamers immediate access to VIDEO tier + 10hr/week quota
    public fun grant_proof_of_effort(
        profile: &mut UserProfile,
        clock: &Clock
    ) {
        assert!(profile.created_at + (7 * 24 * 60 * 60 * 1000) > clock::timestamp_ms(clock), ENotEligibleForEffort); // Only new users (<7 days)
        
        let now = clock::timestamp_ms(clock);
        
        profile.tier_access = TierAccess {
            tier: TIER_VIDEO,
            access_method: ACCESS_EFFORT,
            proof_data: option::some(ProofData {
                granted_at: now,
                expires_at: now + (60 * 24 * 60 * 60 * 1000), // 60 days
                weekly_metrics: vec_map::empty(),
                status: STATUS_TRIAL
            })
        };
        
        profile.effort_quota_minutes = 600; // 10 hours

        event::emit(TrialStarted {
            profile_id: object::id(profile),
            method: ACCESS_EFFORT,
            tier: TIER_VIDEO,
            expires_at: now + (60 * 24 * 60 * 60 * 1000)
        });
    }

    /// Record weekly metrics (Admin Only - from Nautilus)
    /// Works for all users - builds engagement history even for staked users
    public fun record_weekly_metrics(
        _: &AdminCap,
        profile: &mut UserProfile,
        week_number: u64,
        hours_streamed: u64,
        avg_viewers: u64,
        engagement_rate: u64,
        bar_met: bool
    ) {
        // Cache access_method before mutable borrow
        let access_method = profile.tier_access.access_method;
        
        // Initialize proof_data if not present (for staked users building engagement history)
        if (option::is_none(&profile.tier_access.proof_data)) {
            profile.tier_access.proof_data = option::some(ProofData {
                granted_at: 0,
                expires_at: 0,
                weekly_metrics: vec_map::empty(),
                status: STATUS_TRIAL // Will be evaluated when they unstake
            });
        };
        
        let data = option::borrow_mut(&mut profile.tier_access.proof_data);
        
        // Record metrics (for trials, check status; for staked users building history, always allow)
        let should_record = data.status == STATUS_TRIAL || access_method == ACCESS_STAKED;
        
        if (should_record) {
            let metrics = WeeklyMetrics {
                hours_streamed,
                avg_viewers,
                engagement_rate,
                bar_met
            };
            
            if (!vec_map::contains(&data.weekly_metrics, &week_number)) {
                vec_map::insert(&mut data.weekly_metrics, week_number, metrics);
            };
            
            event::emit(MetricsRecorded {
                profile_id: object::id(profile),
                week: week_number,
                bar_met
            });
        }
    }

    /// Evaluate graduation (Admin or Cron)
    public fun evaluate_graduation(
        profile: &mut UserProfile,
        _clock: &Clock
    ) {
        if (option::is_some(&profile.tier_access.proof_data)) {
            // First pass: read-only to determine outcome
            let mut should_graduate = false;
            let mut should_revoke = false;
            {
                let data = option::borrow(&profile.tier_access.proof_data);
                if (data.status != STATUS_TRIAL) { return };

                let total_weeks = vec_map::length(&data.weekly_metrics);
                let mut passing_weeks = 0;
                let mut i = 0;

                while (i < total_weeks) {
                    let (_, metrics) = vec_map::get_entry_by_idx(&data.weekly_metrics, i);
                    if (metrics.bar_met) {
                        passing_weeks = passing_weeks + 1;
                    };
                    i = i + 1;
                };

                if (passing_weeks >= 6 && total_weeks >= 8) {
                    should_graduate = true;
                } else if (total_weeks >= 8) {
                    should_revoke = true;
                };
            };

            // Second pass: mutate proof_data status first, then update sibling fields
            if (should_graduate) {
                {
                    let data = option::borrow_mut(&mut profile.tier_access.proof_data);
                    data.status = STATUS_GRADUATED;
                };
                // Borrow dropped — safe to access sibling fields
                let final_tier = profile.tier_access.tier;
                profile.tier_access.access_method = ACCESS_GRADUATED;

                event::emit(Graduated {
                    profile_id: object::id(profile),
                    method: ACCESS_GRADUATED,
                    final_tier
                });
            } else if (should_revoke) {
                {
                    let data = option::borrow_mut(&mut profile.tier_access.proof_data);
                    data.status = STATUS_REVOKED;
                };
                let old_tier = profile.tier_access.tier;
                profile.tier_access.tier = TIER_AUDIO;

                event::emit(TierUpdated {
                    profile_id: object::id(profile),
                    old_tier,
                    new_tier: TIER_AUDIO,
                    method: ACCESS_GRADUATED,
                    status: STATUS_REVOKED
                });
            };
        }
    }

    /// Unstake all SUI
    /// Tier is recalculated based on engagement history (engagement-based revocation)
    public fun unstake(
        profile: &mut UserProfile,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<SUI> {
        let amount = balance::value(&profile.staked_balance);
        assert!(amount > 0, ENoStakedBalance);

        let withdrawn = balance::withdraw_all(&mut profile.staked_balance);
        let coin = coin::from_balance(withdrawn, ctx);
        let old_tier = profile.tier_access.tier;

        // Only recalculate if they were relying on STAKE access
        if (profile.tier_access.access_method == ACCESS_STAKED) {
            // Check engagement history to determine new access level
            let passing_weeks = count_passing_weeks(&profile.tier_access.proof_data);
            
            if (passing_weeks >= GRADUATION_WEEKS_THRESHOLD) {
                // Good engagement history = graduate to permanent access
                profile.tier_access.access_method = ACCESS_GRADUATED;
                // Keep current tier, they earned it
                
                // Initialize proof_data if not present
                if (option::is_none(&profile.tier_access.proof_data)) {
                    let now = clock::timestamp_ms(clock);
                    profile.tier_access.proof_data = option::some(ProofData {
                        granted_at: now,
                        expires_at: 0, // No expiry for graduated
                        weekly_metrics: vec_map::empty(),
                        status: STATUS_GRADUATED
                    });
                } else {
                    let data = option::borrow_mut(&mut profile.tier_access.proof_data);
                    data.status = STATUS_GRADUATED;
                };
                
                event::emit(Graduated {
                    profile_id: object::id(profile),
                    method: ACCESS_GRADUATED,
                    final_tier: profile.tier_access.tier
                });
            } else if (passing_weeks >= 1) {
                // Some engagement = convert to effort trial
                profile.tier_access.access_method = ACCESS_EFFORT;
                // Downgrade to VIDEO if higher (trial max is VIDEO)
                if (profile.tier_access.tier > TIER_VIDEO) {
                    profile.tier_access.tier = TIER_VIDEO;
                };

                // Initialize proof_data for trial, but don't extend existing trial
                let now = clock::timestamp_ms(clock);
                if (option::is_none(&profile.tier_access.proof_data)) {
                    profile.tier_access.proof_data = option::some(ProofData {
                        granted_at: now,
                        expires_at: now + (60 * 24 * 60 * 60 * 1000), // 60 days
                        weekly_metrics: vec_map::empty(),
                        status: STATUS_TRIAL
                    });
                } else {
                    let data = option::borrow_mut(&mut profile.tier_access.proof_data);
                    // Only set trial if not already in trial (prevent extension exploit)
                    if (data.status != STATUS_TRIAL) {
                        data.status = STATUS_TRIAL;
                        data.expires_at = now + (60 * 24 * 60 * 60 * 1000);
                    };
                    // If already in trial, keep existing expiry
                };
                
                event::emit(TrialStarted {
                    profile_id: object::id(profile),
                    method: ACCESS_EFFORT,
                    tier: profile.tier_access.tier,
                    expires_at: clock::timestamp_ms(clock) + (60 * 24 * 60 * 60 * 1000)
                });
            } else {
                // No engagement = drop to FREE
                profile.tier_access.tier = TIER_FREE;
                profile.tier_access.access_method = ACCESS_STAKED; // Reset to default
                profile.tier_access.proof_data = option::none();
                
                event::emit(RevokedForInactivity {
                    profile_id: object::id(profile),
                    previous_tier: old_tier,
                    reason: 0  // unstake_no_engagement
                });
            };
            
            event::emit(Unstaked {
                profile_id: object::id(profile),
                amount,
                new_tier: profile.tier_access.tier,
            });
        };

        coin
    }

    /// Revoke access for inactive users without stake (Admin Only)
    /// Called periodically by backend to check engagement
    public fun revoke_for_inactivity(
        _: &AdminCap,
        profile: &mut UserProfile,
        _clock: &Clock
    ) {
        // Only applies to users without stake
        assert!(balance::value(&profile.staked_balance) == 0, EHasStakedBalance);
        
        // Only applies to FAME, EFFORT, or GRADUATED users
        let method = profile.tier_access.access_method;
        assert!(
            method == ACCESS_FAME || method == ACCESS_EFFORT || method == ACCESS_GRADUATED,
            ENotSubjectToRevocation
        );
        
        // Check last N weeks for consecutive failures
        let consecutive_failures = count_consecutive_failing_weeks(&profile.tier_access.proof_data);
        
        if (consecutive_failures >= INACTIVITY_WEEKS_THRESHOLD) {
            let old_tier = profile.tier_access.tier;
            
            // Revoke to FREE tier
            profile.tier_access.tier = TIER_FREE;
            profile.tier_access.access_method = ACCESS_STAKED; // Reset
            
            if (option::is_some(&profile.tier_access.proof_data)) {
                let data = option::borrow_mut(&mut profile.tier_access.proof_data);
                data.status = STATUS_REVOKED;
            };
            
            event::emit(RevokedForInactivity {
                profile_id: object::id(profile),
                previous_tier: old_tier,
                reason: 1  // inactivity_check
            });
        }
    }

    // ========== View Functions ==========

    public fun tier(profile: &UserProfile): u8 {
        profile.tier_access.tier
    }

    public fun access_method(profile: &UserProfile): u8 {
        profile.tier_access.access_method
    }

    public fun staked_amount(profile: &UserProfile): u64 {
        balance::value(&profile.staked_balance)
    }

    public fun total_tips_sent(profile: &UserProfile): u64 {
        profile.total_tips_sent
    }

    public fun total_tips_received(profile: &UserProfile): u64 {
        profile.total_tips_received
    }

    public fun total_points(profile: &UserProfile): u64 {
        profile.total_points
    }

    public fun can_create_video_room(profile: &UserProfile): bool {
        profile.tier_access.tier >= TIER_VIDEO
    }

    public fun can_stream_audio(profile: &UserProfile): bool {
        profile.tier_access.tier >= TIER_AUDIO
    }

    // ========== Friend Functions ==========

    public(package) fun add_tips_sent(profile: &mut UserProfile, amount: u64) {
        profile.total_tips_sent = profile.total_tips_sent + amount;
    }

    public(package) fun add_tips_received(profile: &mut UserProfile, amount: u64) {
        profile.total_tips_received = profile.total_tips_received + amount;
    }

    public(package) fun add_points(profile: &mut UserProfile, amount: u64) {
        profile.total_points = profile.total_points + amount;
    }

    // ========== Internal Functions ==========

    fun calculate_stake_tier(staked: u64): u8 {
        if (staked >= STAKE_PREMIUM) {
            TIER_PREMIUM
        } else if (staked >= STAKE_VIDEO) {
            TIER_VIDEO
        } else if (staked >= STAKE_PODCAST) {
            TIER_PODCAST
        } else if (staked >= STAKE_AUDIO) {
            TIER_AUDIO
        } else {
            TIER_FREE
        }
    }
    
    /// Count total passing weeks from proof_data
    fun count_passing_weeks(proof_data: &Option<ProofData>): u64 {
        if (option::is_none(proof_data)) {
            return 0
        };
        
        let data = option::borrow(proof_data);
        let total_weeks = vec_map::length(&data.weekly_metrics);
        let mut passing = 0;
        let mut i = 0;
        
        while (i < total_weeks) {
            let (_, metrics) = vec_map::get_entry_by_idx(&data.weekly_metrics, i);
            if (metrics.bar_met) {
                passing = passing + 1;
            };
            i = i + 1;
        };
        
        passing
    }
    
    /// Count consecutive failing weeks from the end (most recent)
    fun count_consecutive_failing_weeks(proof_data: &Option<ProofData>): u64 {
        if (option::is_none(proof_data)) {
            return 0
        };
        
        let data = option::borrow(proof_data);
        let total_weeks = vec_map::length(&data.weekly_metrics);
        
        if (total_weeks == 0) {
            return 0
        };
        
        // Count from the end backwards
        let mut consecutive_failures = 0;
        let mut i = total_weeks;
        
        while (i > 0) {
            i = i - 1;
            let (_, metrics) = vec_map::get_entry_by_idx(&data.weekly_metrics, i);
            if (!metrics.bar_met) {
                consecutive_failures = consecutive_failures + 1;
            } else {
                // Found a passing week, stop counting
                break
            };
        };
        
        consecutive_failures
    }
    
    // ========== Test Helpers ==========
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
