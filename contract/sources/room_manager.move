/// Module: room_manager
/// Live room creation, joining, and lifecycle management
module tai::room_manager {
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};
    use std::string::String;
    use tai::user_profile::{Self, UserProfile};

    // ========== Error Codes ==========
    const ENotHost: u64 = 0;
    const ERoomNotLive: u64 = 1;
    const EAlreadyJoined: u64 = 2;
    const ENotJoined: u64 = 3;
    const EInsufficientTier: u64 = 4;

    // ========== Structs ==========

    /// Room object (shared)
    public struct Room has key {
        id: UID,
        host: address,
        title: String,
        category: String,
        is_live: bool,
        is_video: bool,  // true = video room, false = audio only
        created_at: u64,
        ended_at: u64,  // 0 if still live
        connection_count: u64,
        total_watch_seconds: u64,
        // Map from viewer address to connection ID
        active_connections: Table<address, ID>,
    }

    /// Connection object (owned by viewer)
    public struct RoomConnection has key, store {
        id: UID,
        viewer: address,
        room_id: ID,
        join_time: u64,
        disconnect_time: u64,  // 0 if still connected
        watch_seconds: u64,
        is_active: bool,
    }

    // ========== Events ==========

    public struct RoomCreated has copy, drop {
        room_id: ID,
        host: address,
        title: String,
        is_video: bool,
        timestamp: u64,
    }

    public struct ViewerJoined has copy, drop {
        room_id: ID,
        viewer: address,
        connection_id: ID,
        timestamp: u64,
    }

    public struct ViewerLeft has copy, drop {
        room_id: ID,
        viewer: address,
        watch_seconds: u64,
        timestamp: u64,
    }

    public struct RoomEnded has copy, drop {
        room_id: ID,
        host: address,
        total_connections: u64,
        total_watch_seconds: u64,
        timestamp: u64,
    }

    // ========== Public Functions ==========

    /// Create a new room
    public fun create_room(
        profile: &UserProfile,
        title: String,
        category: String,
        is_video: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ): Room {
        // Check tier requirements
        if (is_video) {
            assert!(user_profile::can_create_video_room(profile), EInsufficientTier);
        } else {
            assert!(user_profile::can_stream_audio(profile), EInsufficientTier);
        };

        let host = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        let room = Room {
            id: object::new(ctx),
            host,
            title,
            category,
            is_live: true,
            is_video,
            created_at: now,
            ended_at: 0,
            connection_count: 0,
            total_watch_seconds: 0,
            active_connections: table::new(ctx),
        };

        event::emit(RoomCreated {
            room_id: object::id(&room),
            host,
            title: room.title,
            is_video,
            timestamp: now,
        });

        room
    }

    /// Create and share a room
    public fun create_and_share(
        profile: &UserProfile,
        title: String,
        category: String,
        is_video: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let room = create_room(profile, title, category, is_video, clock, ctx);
        transfer::share_object(room);
    }

    /// Join a room as a viewer
    public fun join_room(
        room: &mut Room,
        clock: &Clock,
        ctx: &mut TxContext
    ): RoomConnection {
        assert!(room.is_live, ERoomNotLive);

        let viewer = tx_context::sender(ctx);
        assert!(!table::contains(&room.active_connections, viewer), EAlreadyJoined);

        let now = clock::timestamp_ms(clock);

        let connection = RoomConnection {
            id: object::new(ctx),
            viewer,
            room_id: object::id(room),
            join_time: now,
            disconnect_time: 0,
            watch_seconds: 0,
            is_active: true,
        };

        // Track in room
        table::add(&mut room.active_connections, viewer, object::id(&connection));
        room.connection_count = room.connection_count + 1;

        event::emit(ViewerJoined {
            room_id: object::id(room),
            viewer,
            connection_id: object::id(&connection),
            timestamp: now,
        });

        connection
    }

    /// Leave a room (disconnect)
    public fun leave_room(
        room: &mut Room,
        connection: RoomConnection,
        watch_seconds: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let viewer = tx_context::sender(ctx);
        assert!(connection.viewer == viewer, ENotJoined);
        assert!(connection.is_active, ENotJoined);

        let now = clock::timestamp_ms(clock);

        // Remove from active connections
        if (table::contains(&room.active_connections, viewer)) {
            table::remove(&mut room.active_connections, viewer);
        };

        // Update room stats
        room.total_watch_seconds = room.total_watch_seconds + watch_seconds;

        event::emit(ViewerLeft {
            room_id: object::id(room),
            viewer,
            watch_seconds,
            timestamp: now,
        });

        // Destroy connection object
        let RoomConnection { id, viewer: _, room_id: _, join_time: _, disconnect_time: _, watch_seconds: _, is_active: _ } = connection;
        object::delete(id);
    }

    /// End the room (host only)
    public fun end_room(
        room: &mut Room,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let host = tx_context::sender(ctx);
        assert!(room.host == host, ENotHost);
        assert!(room.is_live, ERoomNotLive);

        let now = clock::timestamp_ms(clock);

        room.is_live = false;
        room.ended_at = now;

        event::emit(RoomEnded {
            room_id: object::id(room),
            host,
            total_connections: room.connection_count,
            total_watch_seconds: room.total_watch_seconds,
            timestamp: now,
        });
    }

    // ========== View Functions ==========

    public fun is_host(room: &Room, addr: address): bool {
        room.host == addr
    }

    public fun is_live(room: &Room): bool {
        room.is_live
    }

    public fun host(room: &Room): address {
        room.host
    }

    public fun connection_count(room: &Room): u64 {
        room.connection_count
    }
}
