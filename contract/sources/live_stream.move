/// Module: live_stream
/// On-chain registry for active live streams, supporting Tai Live discovery and VOD tracking
module tai::live_stream {
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use std::string::{Self, String};
    use std::vector;

    // ========== Error Codes ==========
    const EStreamNotActive: u64 = 0;
    const ENotBroadcaster: u64 = 1;
    const EStreamAlreadyActive: u64 = 2;
    const EInvalidRoomId: u64 = 3;
    const EInvalidTag: u64 = 4;
    const ETagTooLong: u64 = 5;
    const ETooManyTags: u64 = 6;

    // ========== Stream Status ==========
    const STATUS_LIVE: u8 = 0;
    const STATUS_ENDED: u8 = 1;
    const STATUS_PAUSED: u8 = 2;

    // ========== Stream Tier (mirrors user_profile) ==========
    const TIER_FREE: u8 = 0;
    const TIER_AUDIO: u8 = 1;
    const TIER_PODCAST: u8 = 2;
    const TIER_VIDEO: u8 = 3;
    const TIER_PREMIUM: u8 = 4;

    // ========== Structs ==========

    /// Global registry for tracking all streams
    public struct StreamRegistry has key {
        id: UID,
        total_streams: u64,
        total_watch_minutes: u64,
    }

    /// Individual live stream object
    public struct LiveStream has key, store {
        id: UID,
        /// The broadcaster's address
        broadcaster: address,
        /// Unique room identifier (used for routing)
        room_id: String,
        /// Human-readable title
        title: String,
        /// Stream category/game
        category: String,
        /// Tags for discovery
        tags: vector<String>,
        /// Stream tier (determines quality/features)
        tier: u8,
        /// Current status (live, ended, paused)
        status: u8,
        /// Walrus bucket/blob ID for VOD storage
        walrus_blob_id: String,
        /// Timestamp when stream started
        started_at: u64,
        /// Timestamp when stream ended (0 if still live)
        ended_at: u64,
        /// Peak concurrent viewers
        peak_viewers: u64,
        /// Total unique viewers
        total_viewers: u64,
        /// Total minutes watched across all viewers
        total_watch_minutes: u64,
        /// Whether VOD is available
        has_vod: bool,
        /// Privacy mode enabled (E2EE)
        privacy_mode: bool,
    }

    /// Capability for stream owner to manage their stream
    public struct StreamOwnerCap has key, store {
        id: UID,
        stream_id: ID,
    }

    // ========== Events ==========

    public struct StreamStarted has copy, drop {
        stream_id: ID,
        broadcaster: address,
        room_id: String,
        title: String,
        tier: u8,
        started_at: u64,
    }

    public struct StreamEnded has copy, drop {
        stream_id: ID,
        broadcaster: address,
        room_id: String,
        duration_seconds: u64,
        total_viewers: u64,
        total_watch_minutes: u64,
    }

    public struct StreamUpdated has copy, drop {
        stream_id: ID,
        title: String,
        category: String,
    }

    public struct ViewerJoined has copy, drop {
        stream_id: ID,
        viewer: address,
        joined_at: u64,
    }

    public struct ViewerLeft has copy, drop {
        stream_id: ID,
        viewer: address,
        watch_minutes: u64,
    }

    // ========== Init ==========

    fun init(ctx: &mut TxContext) {
        let registry = StreamRegistry {
            id: object::new(ctx),
            total_streams: 0,
            total_watch_minutes: 0,
        };
        transfer::share_object(registry);
    }

    // ========== Public Functions ==========

    /// Start a new live stream
    public fun start_stream(
        registry: &mut StreamRegistry,
        room_id: vector<u8>,
        title: vector<u8>,
        category: vector<u8>,
        tier: u8,
        privacy_mode: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ): StreamOwnerCap {
        let broadcaster = tx_context::sender(ctx);
        let room_id_str = string::utf8(room_id);
        let title_str = string::utf8(title);
        let category_str = string::utf8(category);
        let now = clock::timestamp_ms(clock);

        // Validate room_id is not empty
        assert!(string::length(&room_id_str) > 0, EInvalidRoomId);

        let stream = LiveStream {
            id: object::new(ctx),
            broadcaster,
            room_id: room_id_str,
            title: title_str,
            category: category_str,
            tags: vector::empty(),
            tier,
            status: STATUS_LIVE,
            walrus_blob_id: string::utf8(b""),
            started_at: now,
            ended_at: 0,
            peak_viewers: 0,
            total_viewers: 0,
            total_watch_minutes: 0,
            has_vod: false,
            privacy_mode,
        };

        let stream_id = object::id(&stream);

        // Emit event
        event::emit(StreamStarted {
            stream_id,
            broadcaster,
            room_id: string::utf8(room_id),
            title: string::utf8(title),
            tier,
            started_at: now,
        });

        // Update registry
        registry.total_streams = registry.total_streams + 1;

        // Create owner capability
        let owner_cap = StreamOwnerCap {
            id: object::new(ctx),
            stream_id,
        };

        // Share the stream object
        transfer::share_object(stream);

        owner_cap
    }

    /// End a live stream
    public fun end_stream(
        registry: &mut StreamRegistry,
        stream: &mut LiveStream,
        cap: &StreamOwnerCap,
        walrus_blob_id: vector<u8>,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        // Verify ownership
        assert!(cap.stream_id == object::id(stream), ENotBroadcaster);
        assert!(stream.status == STATUS_LIVE, EStreamNotActive);

        let now = clock::timestamp_ms(clock);
        let duration_seconds = (now - stream.started_at) / 1000;

        stream.status = STATUS_ENDED;
        stream.ended_at = now;
        stream.walrus_blob_id = string::utf8(walrus_blob_id);
        stream.has_vod = vector::length(&walrus_blob_id) > 0;

        // Update global stats
        registry.total_watch_minutes = registry.total_watch_minutes + stream.total_watch_minutes;

        event::emit(StreamEnded {
            stream_id: object::id(stream),
            broadcaster: stream.broadcaster,
            room_id: stream.room_id,
            duration_seconds,
            total_viewers: stream.total_viewers,
            total_watch_minutes: stream.total_watch_minutes,
        });
    }

    /// Update stream metadata (title, category)
    public fun update_stream(
        stream: &mut LiveStream,
        cap: &StreamOwnerCap,
        title: vector<u8>,
        category: vector<u8>,
        _ctx: &mut TxContext
    ) {
        assert!(cap.stream_id == object::id(stream), ENotBroadcaster);
        assert!(stream.status == STATUS_LIVE, EStreamNotActive);

        stream.title = string::utf8(title);
        stream.category = string::utf8(category);

        event::emit(StreamUpdated {
            stream_id: object::id(stream),
            title: stream.title,
            category: stream.category,
        });
    }

    /// Add a tag to the stream
    public fun add_tag(
        stream: &mut LiveStream,
        cap: &StreamOwnerCap,
        tag: vector<u8>,
        _ctx: &mut TxContext
    ) {
        assert!(cap.stream_id == object::id(stream), ENotBroadcaster);
        assert!(vector::length(&tag) > 0, EInvalidTag);
        assert!(vector::length(&tag) <= 50, ETagTooLong);
        assert!(vector::length(&stream.tags) < 20, ETooManyTags);
        vector::push_back(&mut stream.tags, string::utf8(tag));
    }

    /// Record a viewer joining (called by stream owner / relay nodes)
    public fun record_viewer_join(
        stream: &mut LiveStream,
        cap: &StreamOwnerCap,
        viewer: address,
        clock: &Clock,
        _ctx: &mut TxContext
    ) {
        assert!(cap.stream_id == object::id(stream), ENotBroadcaster);
        assert!(stream.status == STATUS_LIVE, EStreamNotActive);

        stream.total_viewers = stream.total_viewers + 1;
        
        // Update peak if needed
        // Note: In production, we'd track current viewers, not just total
        if (stream.total_viewers > stream.peak_viewers) {
            stream.peak_viewers = stream.total_viewers;
        };

        event::emit(ViewerJoined {
            stream_id: object::id(stream),
            viewer,
            joined_at: clock::timestamp_ms(clock),
        });
    }

    /// Record viewer leaving and watch time
    public fun record_viewer_leave(
        stream: &mut LiveStream,
        cap: &StreamOwnerCap,
        viewer: address,
        watch_minutes: u64,
        _ctx: &mut TxContext
    ) {
        assert!(cap.stream_id == object::id(stream), ENotBroadcaster);
        stream.total_watch_minutes = stream.total_watch_minutes + watch_minutes;

        event::emit(ViewerLeft {
            stream_id: object::id(stream),
            viewer,
            watch_minutes,
        });
    }

    /// Set Walrus blob ID for VOD
    public fun set_walrus_blob(
        stream: &mut LiveStream,
        cap: &StreamOwnerCap,
        blob_id: vector<u8>,
        _ctx: &mut TxContext
    ) {
        assert!(cap.stream_id == object::id(stream), ENotBroadcaster);
        stream.walrus_blob_id = string::utf8(blob_id);
        stream.has_vod = vector::length(&blob_id) > 0;
    }

    // ========== View Functions ==========

    public fun is_live(stream: &LiveStream): bool {
        stream.status == STATUS_LIVE
    }

    public fun get_broadcaster(stream: &LiveStream): address {
        stream.broadcaster
    }

    public fun get_room_id(stream: &LiveStream): String {
        stream.room_id
    }

    public fun get_tier(stream: &LiveStream): u8 {
        stream.tier
    }

    public fun get_walrus_blob_id(stream: &LiveStream): String {
        stream.walrus_blob_id
    }

    public fun get_total_viewers(stream: &LiveStream): u64 {
        stream.total_viewers
    }

    public fun get_total_watch_minutes(stream: &LiveStream): u64 {
        stream.total_watch_minutes
    }

    public fun get_started_at(stream: &LiveStream): u64 {
        stream.started_at
    }

    public fun get_duration_seconds(stream: &LiveStream, clock: &Clock): u64 {
        if (stream.status == STATUS_LIVE) {
            (clock::timestamp_ms(clock) - stream.started_at) / 1000
        } else {
            (stream.ended_at - stream.started_at) / 1000
        }
    }

    public fun has_vod(stream: &LiveStream): bool {
        stream.has_vod
    }

    public fun is_privacy_mode(stream: &LiveStream): bool {
        stream.privacy_mode
    }

    public fun get_registry_stats(registry: &StreamRegistry): (u64, u64) {
        (registry.total_streams, registry.total_watch_minutes)
    }

    // ========== Test Helpers ==========

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }

    #[test_only]
    public fun get_status(stream: &LiveStream): u8 {
        stream.status
    }
}
