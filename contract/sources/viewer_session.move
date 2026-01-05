/// Module: viewer_session
/// Tracks viewer watch sessions for rewards, analytics, and proof-of-viewing
module tai::viewer_session {
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};

    // ========== Error Codes ==========
    const ESessionNotActive: u64 = 0;
    const ESessionAlreadyExists: u64 = 1;
    const ENotSessionOwner: u64 = 2;
    const EStreamNotFound: u64 = 3;
    const EMinimumWatchTimeNotMet: u64 = 4;

    // ========== Constants ==========
    const MINIMUM_WATCH_SECONDS: u64 = 60; // 1 minute minimum for rewards
    const POINTS_PER_MINUTE: u64 = 1;      // 1 point per minute watched

    // ========== Structs ==========

    /// Global registry for all viewer sessions
    public struct SessionRegistry has key {
        id: UID,
        /// Map from viewer address to their active session count
        active_sessions: Table<address, u64>,
        /// Total watch minutes across all sessions
        total_watch_minutes: u64,
        /// Total sessions created
        total_sessions: u64,
    }

    /// Individual viewer session for a stream
    public struct ViewerSession has key, store {
        id: UID,
        /// Viewer's address
        viewer: address,
        /// Stream ID being watched
        stream_id: ID,
        /// Node operator that served this viewer
        relay_node: address,
        /// When the session started
        started_at: u64,
        /// When the session ended (0 if still active)
        ended_at: u64,
        /// Total seconds watched
        watch_seconds: u64,
        /// Whether session is still active
        is_active: bool,
        /// Points earned from this session
        points_earned: u64,
        /// Whether rewards have been claimed
        rewards_claimed: bool,
    }

    /// Proof that a viewer watched a stream (claimable NFT)
    public struct WatchProof has key, store {
        id: UID,
        viewer: address,
        stream_id: ID,
        watch_minutes: u64,
        earned_at: u64,
    }

    // ========== Events ==========

    public struct SessionStarted has copy, drop {
        session_id: ID,
        viewer: address,
        stream_id: ID,
        relay_node: address,
        started_at: u64,
    }

    public struct SessionEnded has copy, drop {
        session_id: ID,
        viewer: address,
        stream_id: ID,
        watch_seconds: u64,
        points_earned: u64,
    }

    public struct RewardsClaimed has copy, drop {
        session_id: ID,
        viewer: address,
        points: u64,
    }

    // ========== Init ==========

    fun init(ctx: &mut TxContext) {
        let registry = SessionRegistry {
            id: object::new(ctx),
            active_sessions: table::new(ctx),
            total_watch_minutes: 0,
            total_sessions: 0,
        };
        transfer::share_object(registry);
    }

    // ========== Public Functions ==========

    /// Start a new viewer session
    public fun start_session(
        registry: &mut SessionRegistry,
        stream_id: ID,
        relay_node: address,
        clock: &Clock,
        ctx: &mut TxContext
    ): ViewerSession {
        let viewer = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        let session = ViewerSession {
            id: object::new(ctx),
            viewer,
            stream_id,
            relay_node,
            started_at: now,
            ended_at: 0,
            watch_seconds: 0,
            is_active: true,
            points_earned: 0,
            rewards_claimed: false,
        };

        let session_id = object::id(&session);

        // Update registry
        if (table::contains(&registry.active_sessions, viewer)) {
            let count = table::borrow_mut(&mut registry.active_sessions, viewer);
            *count = *count + 1;
        } else {
            table::add(&mut registry.active_sessions, viewer, 1);
        };
        registry.total_sessions = registry.total_sessions + 1;

        event::emit(SessionStarted {
            session_id,
            viewer,
            stream_id,
            relay_node,
            started_at: now,
        });

        session
    }

    /// End a viewer session and calculate rewards
    public fun end_session(
        registry: &mut SessionRegistry,
        session: &mut ViewerSession,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(session.is_active, ESessionNotActive);

        let now = clock::timestamp_ms(clock);
        let duration_ms = now - session.started_at;
        let watch_seconds = duration_ms / 1000;

        session.ended_at = now;
        session.watch_seconds = watch_seconds;
        session.is_active = false;

        // Calculate points (1 point per minute)
        let watch_minutes = watch_seconds / 60;
        session.points_earned = watch_minutes * POINTS_PER_MINUTE;

        // Update registry
        let viewer = session.viewer;
        if (table::contains(&registry.active_sessions, viewer)) {
            let count = table::borrow_mut(&mut registry.active_sessions, viewer);
            if (*count > 0) {
                *count = *count - 1;
            };
        };
        registry.total_watch_minutes = registry.total_watch_minutes + watch_minutes;

        event::emit(SessionEnded {
            session_id: object::id(session),
            viewer: session.viewer,
            stream_id: session.stream_id,
            watch_seconds,
            points_earned: session.points_earned,
        });
    }

    /// Claim rewards and get a WatchProof NFT
    public fun claim_rewards(
        session: &mut ViewerSession,
        clock: &Clock,
        ctx: &mut TxContext
    ): WatchProof {
        assert!(!session.is_active, ESessionNotActive);
        assert!(!session.rewards_claimed, ENotSessionOwner);
        assert!(session.watch_seconds >= MINIMUM_WATCH_SECONDS, EMinimumWatchTimeNotMet);
        assert!(tx_context::sender(ctx) == session.viewer, ENotSessionOwner);

        session.rewards_claimed = true;

        let watch_minutes = session.watch_seconds / 60;

        event::emit(RewardsClaimed {
            session_id: object::id(session),
            viewer: session.viewer,
            points: session.points_earned,
        });

        WatchProof {
            id: object::new(ctx),
            viewer: session.viewer,
            stream_id: session.stream_id,
            watch_minutes,
            earned_at: clock::timestamp_ms(clock),
        }
    }

    /// Update watch time for heartbeat (called periodically by relay nodes)
    public fun heartbeat(
        session: &mut ViewerSession,
        additional_seconds: u64,
        _ctx: &mut TxContext
    ) {
        assert!(session.is_active, ESessionNotActive);
        session.watch_seconds = session.watch_seconds + additional_seconds;
    }

    // ========== View Functions ==========

    public fun is_active(session: &ViewerSession): bool {
        session.is_active
    }

    public fun get_viewer(session: &ViewerSession): address {
        session.viewer
    }

    public fun get_stream_id(session: &ViewerSession): ID {
        session.stream_id
    }

    public fun get_relay_node(session: &ViewerSession): address {
        session.relay_node
    }

    public fun get_watch_seconds(session: &ViewerSession): u64 {
        session.watch_seconds
    }

    public fun get_points_earned(session: &ViewerSession): u64 {
        session.points_earned
    }

    public fun is_rewards_claimed(session: &ViewerSession): bool {
        session.rewards_claimed
    }

    public fun get_registry_stats(registry: &SessionRegistry): (u64, u64) {
        (registry.total_sessions, registry.total_watch_minutes)
    }

    public fun get_active_session_count(registry: &SessionRegistry, viewer: address): u64 {
        if (table::contains(&registry.active_sessions, viewer)) {
            *table::borrow(&registry.active_sessions, viewer)
        } else {
            0
        }
    }

    // ========== Test Helpers ==========

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
