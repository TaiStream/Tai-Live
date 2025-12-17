/// Module: points
/// Soulbound points tracking for future token airdrop
module tai::points {
    use sui::event;
    use tai::user_profile::{Self, UserProfile};

    // ========== Points Constants ==========
    const POINTS_PER_MINUTE_STREAMING: u64 = 10;
    const POINTS_PER_MINUTE_WATCHING: u64 = 1;
    const POINTS_PER_SUI_TIPPED_SENT: u64 = 2;
    const POINTS_PER_SUI_TIPPED_RECEIVED: u64 = 5;
    const POINTS_PER_SUI_BET: u64 = 3;
    const POINTS_PER_PREDICTION_WIN: u64 = 50;

    // ========== Structs ==========

    /// Global points registry (shared object)
    public struct PointsRegistry has key {
        id: UID,
        total_points_issued: u64,
        total_users: u64,
    }

    // ========== Events ==========

    public struct PointsAwarded has copy, drop {
        user: address,
        amount: u64,
        activity_type: u8,  // 0=streaming, 1=watching, 2=tip_sent, 3=tip_recv, 4=bet, 5=win
        total_points: u64,
    }

    // ========== Init ==========

    fun init(ctx: &mut TxContext) {
        let registry = PointsRegistry {
            id: object::new(ctx),
            total_points_issued: 0,
            total_users: 0,
        };
        transfer::share_object(registry);
    }

    // ========== Public Functions ==========

    /// Award points for streaming (10 per minute)
    public fun award_streaming_points(
        registry: &mut PointsRegistry,
        profile: &mut UserProfile,
        minutes: u64,
        ctx: &mut TxContext
    ) {
        let points = minutes * POINTS_PER_MINUTE_STREAMING;
        award_points_internal(registry, profile, points, 0, ctx);
    }

    /// Award points for watching (1 per minute)
    public fun award_watching_points(
        registry: &mut PointsRegistry,
        profile: &mut UserProfile,
        minutes: u64,
        ctx: &mut TxContext
    ) {
        let points = minutes * POINTS_PER_MINUTE_WATCHING;
        award_points_internal(registry, profile, points, 1, ctx);
    }

    /// Award points for sending a tip (2 per SUI)
    public fun award_tip_sent_points(
        registry: &mut PointsRegistry,
        profile: &mut UserProfile,
        amount_sui: u64,
        ctx: &mut TxContext
    ) {
        let points = amount_sui * POINTS_PER_SUI_TIPPED_SENT;
        award_points_internal(registry, profile, points, 2, ctx);
    }

    /// Award points for receiving a tip (5 per SUI)
    public fun award_tip_received_points(
        registry: &mut PointsRegistry,
        profile: &mut UserProfile,
        amount_sui: u64,
        ctx: &mut TxContext
    ) {
        let points = amount_sui * POINTS_PER_SUI_TIPPED_RECEIVED;
        award_points_internal(registry, profile, points, 3, ctx);
    }

    /// Award points for placing a bet (3 per SUI)
    public fun award_bet_points(
        registry: &mut PointsRegistry,
        profile: &mut UserProfile,
        amount_sui: u64,
        ctx: &mut TxContext
    ) {
        let points = amount_sui * POINTS_PER_SUI_BET;
        award_points_internal(registry, profile, points, 4, ctx);
    }

    /// Award points for winning a prediction (50 bonus)
    public fun award_prediction_win_points(
        registry: &mut PointsRegistry,
        profile: &mut UserProfile,
        ctx: &mut TxContext
    ) {
        let points = POINTS_PER_PREDICTION_WIN;
        award_points_internal(registry, profile, points, 5, ctx);
    }

    // ========== View Functions ==========

    public fun total_points_issued(registry: &PointsRegistry): u64 {
        registry.total_points_issued
    }

    public fun total_users(registry: &PointsRegistry): u64 {
        registry.total_users
    }

    // ========== Internal Functions ==========

    fun award_points_internal(
        registry: &mut PointsRegistry,
        profile: &mut UserProfile,
        points: u64,
        activity_type: u8,
        ctx: &mut TxContext
    ) {
        user_profile::add_points(profile, points);
        registry.total_points_issued = registry.total_points_issued + points;

        event::emit(PointsAwarded {
            user: tx_context::sender(ctx),
            amount: points,
            activity_type,
            total_points: user_profile::total_points(profile),
        });
    }

    // ========== Test Helpers ==========
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
