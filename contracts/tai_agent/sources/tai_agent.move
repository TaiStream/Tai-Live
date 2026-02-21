/// Module: tai_agent
/// Tai-specific extension for SAI AgentIdentity.
///
/// Adds platform-specific fields (avatar style, category, session tracking)
/// that are relevant to the Tai live-interaction platform but not part of
/// the general SAI standard.
#[allow(lint(public_entry))]
module tai_agent::tai_agent {
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::String;
    use sai::agent_registry::AgentIdentity;

    // ============================= Error Codes =============================
    const ENotProfileOwner: u64 = 0;
    const EInvalidCategory: u64 = 1;

    // ============================= Constants ===============================
    /// Tai agent categories:
    /// 0 = General / multi-purpose assistant
    /// 1 = Communication (translator, transcriber, meeting agent)
    /// 2 = Moderation / safety (content filter, compliance)
    /// 3 = DeFi / trading (portfolio, swap, yield, MEV)
    /// 4 = Data / analytics (indexer, oracle, researcher)
    /// 5 = Creative (image gen, music, writing, design)
    /// 6 = Gaming (NPC, companion, game master)
    /// 7 = Infrastructure (relayer, bridge, validator)
    /// 8 = Social (reputation, matching, recommendation)
    /// 9 = Custom / other
    const MAX_CATEGORY: u8 = 9;

    // ============================= Structs =================================

    /// Tai-specific profile linked to a SAI AgentIdentity.
    /// Owned object — only the creator can modify it.
    public struct TaiAgentProfile has key, store {
        id: UID,
        /// Object ID of the linked SAI AgentIdentity
        agent_id: ID,
        /// Address that created this profile
        owner: address,
        /// Avatar style identifier for rendering
        avatar_style: String,
        /// Tai platform category (0-9)
        category: u8,
        /// Total sessions this agent has participated in
        total_sessions: u64,
        /// Timestamp (ms) of last session participation (0 if never)
        last_session_at: u64,
    }

    // ============================= Events ==================================

    /// Emitted when a Tai profile is created
    public struct TaiProfileCreated has copy, drop {
        profile_id: ID,
        agent_id: ID,
        owner: address,
        category: u8,
    }

    /// Emitted when a session is recorded
    public struct SessionRecorded has copy, drop {
        profile_id: ID,
        agent_id: ID,
        session_id: vector<u8>,
        timestamp: u64,
    }

    // ============================= Functions ===============================

    /// Create a Tai profile linked to an existing SAI AgentIdentity.
    public entry fun create_profile(
        agent: &AgentIdentity,
        avatar_style: String,
        category: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(category <= MAX_CATEGORY, EInvalidCategory);

        let sender = tx_context::sender(ctx);
        let agent_id = sai::agent_registry::get_agent_id(agent);
        let _ = clock::timestamp_ms(clock);

        let profile = TaiAgentProfile {
            id: object::new(ctx),
            agent_id,
            owner: sender,
            avatar_style,
            category,
            total_sessions: 0,
            last_session_at: 0,
        };

        let profile_id = object::id(&profile);

        event::emit(TaiProfileCreated {
            profile_id,
            agent_id,
            owner: sender,
            category,
        });

        transfer::transfer(profile, sender);
    }

    /// Record that agent participated in a session.
    ///
    /// # Errors
    /// * `ENotProfileOwner` — if caller is not the profile owner
    public entry fun record_session(
        profile: &mut TaiAgentProfile,
        session_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == profile.owner, ENotProfileOwner);

        let now = clock::timestamp_ms(clock);
        profile.total_sessions = profile.total_sessions + 1;
        profile.last_session_at = now;

        event::emit(SessionRecorded {
            profile_id: object::id(profile),
            agent_id: profile.agent_id,
            session_id,
            timestamp: now,
        });
    }

    /// Check if agent can join a Tai room.
    /// Requires both SAI-level operability and an active Tai profile.
    public fun can_join_room(
        agent: &AgentIdentity,
        _profile: &TaiAgentProfile,
    ): bool {
        sai::agent_registry::can_operate(agent)
    }

    /// Update avatar style.
    ///
    /// # Errors
    /// * `ENotProfileOwner` — if caller is not the profile owner
    public entry fun set_avatar_style(
        profile: &mut TaiAgentProfile,
        new_style: String,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == profile.owner, ENotProfileOwner);
        profile.avatar_style = new_style;
    }

    /// Update category.
    ///
    /// # Errors
    /// * `ENotProfileOwner` — if caller is not the profile owner
    /// * `EInvalidCategory` — if category > 9
    public entry fun set_category(
        profile: &mut TaiAgentProfile,
        new_category: u8,
        ctx: &mut TxContext,
    ) {
        assert!(tx_context::sender(ctx) == profile.owner, ENotProfileOwner);
        assert!(new_category <= MAX_CATEGORY, EInvalidCategory);
        profile.category = new_category;
    }

    // ============================= View Functions ==========================

    public fun get_agent_id(profile: &TaiAgentProfile): ID {
        profile.agent_id
    }

    public fun get_owner(profile: &TaiAgentProfile): address {
        profile.owner
    }

    public fun get_avatar_style(profile: &TaiAgentProfile): String {
        profile.avatar_style
    }

    public fun get_category(profile: &TaiAgentProfile): u8 {
        profile.category
    }

    public fun get_total_sessions(profile: &TaiAgentProfile): u64 {
        profile.total_sessions
    }

    public fun get_last_session_at(profile: &TaiAgentProfile): u64 {
        profile.last_session_at
    }

    // ============================= Test Helpers ============================
    #[test_only]
    public fun create_profile_for_testing(
        agent: &AgentIdentity,
        avatar_style: String,
        category: u8,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        create_profile(agent, avatar_style, category, clock, ctx);
    }
}
