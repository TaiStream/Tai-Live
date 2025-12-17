/// Module: reputation
/// Tai Cred reputation system for transparent content moderation
module tai::reputation {
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::table::{Self, Table};

    // ========== Error Codes ==========
    const EReportNotFound: u64 = 0;
    const EAlreadyVoted: u64 = 1;
    const EVotingNotOpen: u64 = 2;
    const EReportAlreadyResolved: u64 = 3;
    const ESelfReport: u64 = 4;
    const EInsufficientCred: u64 = 5;

    // ========== Constants ==========
    
    // Cred scoring
    const STARTING_CRED: u64 = 100;
    const MAX_CRED: u64 = 100;
    const MIN_CRED: u64 = 0;
    
    // Visibility tier thresholds
    const TIER_PRISTINE: u8 = 0;     // 90-100: Boosted visibility
    const TIER_STANDARD: u8 = 1;     // 70-89: Normal
    const TIER_RESTRICTED: u8 = 2;   // 50-69: Removed from trending
    const TIER_PROBATION: u8 = 3;    // 30-49: Search hidden, warning overlay
    const TIER_SUSPENDED: u8 = 4;    // 0-29: Account locked
    
    const CRED_PRISTINE_MIN: u64 = 90;
    const CRED_STANDARD_MIN: u64 = 70;
    const CRED_RESTRICTED_MIN: u64 = 50;
    const CRED_PROBATION_MIN: u64 = 30;
    
    // Penalties
    const CRED_PENALTY_WARNING: u64 = 5;
    const CRED_PENALTY_VIOLATION: u64 = 15;
    const CRED_PENALTY_SEVERE: u64 = 30;
    
    // Jury requirements
    const MIN_JUROR_CRED: u64 = 95;
    const VOTING_PERIOD_MS: u64 = 86_400_000; // 24 hours
    
    // Report reasons
    const REASON_HARASSMENT: u8 = 1;
    const REASON_NSFW: u8 = 2;
    const REASON_SPAM: u8 = 3;
    const REASON_COPYRIGHT: u8 = 4;

    // ========== Structs ==========

    /// Shared registry tracking all reputation data
    public struct ReputationRegistry has key {
        id: UID,
        cred_scores: Table<address, u64>,
        report_counter: u64,
        reports: Table<u64, Report>,
    }

    /// A report against a user (simplified - direct voting)
    public struct Report has store {
        id: u64,
        reporter: address,
        target: address,
        reason: u8,
        evidence_hash: vector<u8>,
        created_at: u64,
        voting_ends_at: u64,
        guilty_votes: u64,
        innocent_votes: u64,
        voters: vector<address>,
        resolved: bool,
        resolution: u8, // 0=pending, 1=guilty, 2=innocent
    }

    // ========== Events ==========

    public struct CredAwarded has copy, drop {
        user: address,
        amount: u64,
        new_score: u64,
    }

    public struct CredDeducted has copy, drop {
        user: address,
        amount: u64,
        new_score: u64,
    }

    public struct ReportSubmitted has copy, drop {
        report_id: u64,
        reporter: address,
        target: address,
        reason: u8,
    }

    public struct VoteCast has copy, drop {
        report_id: u64,
        juror: address,
        vote: bool, // true=guilty, false=innocent
    }

    public struct ReportResolved has copy, drop {
        report_id: u64,
        target: address,
        resolution: u8,
        penalty: u64,
    }

    public struct VisibilityChanged has copy, drop {
        user: address,
        old_tier: u8,
        new_tier: u8,
    }

    // ========== Init ==========

    fun init(ctx: &mut TxContext) {
        let registry = ReputationRegistry {
            id: object::new(ctx),
            cred_scores: table::new(ctx),
            report_counter: 0,
            reports: table::new(ctx),
        };
        transfer::share_object(registry);
    }

    // ========== Public Functions ==========

    /// Initialize cred score for a new user
    public fun initialize_cred(
        registry: &mut ReputationRegistry,
        user: address,
        _ctx: &mut TxContext
    ) {
        if (!table::contains(&registry.cred_scores, user)) {
            table::add(&mut registry.cred_scores, user, STARTING_CRED);
        };
    }

    /// Award cred to a user
    public fun award_cred(
        registry: &mut ReputationRegistry,
        user: address,
        amount: u64,
        _ctx: &mut TxContext
    ) {
        ensure_cred_exists(registry, user);
        
        let current = *table::borrow(&registry.cred_scores, user);
        let old_tier = calculate_visibility_tier(current);
        let new_score = if (current + amount > MAX_CRED) { MAX_CRED } else { current + amount };
        
        *table::borrow_mut(&mut registry.cred_scores, user) = new_score;
        
        let new_tier = calculate_visibility_tier(new_score);
        
        event::emit(CredAwarded { user, amount, new_score });
        
        if (old_tier != new_tier) {
            event::emit(VisibilityChanged { user, old_tier, new_tier });
        };
    }

    /// Deduct cred from a user
    public fun deduct_cred(
        registry: &mut ReputationRegistry,
        user: address,
        amount: u64,
        _ctx: &mut TxContext
    ) {
        ensure_cred_exists(registry, user);
        
        let current = *table::borrow(&registry.cred_scores, user);
        let old_tier = calculate_visibility_tier(current);
        let new_score = if (amount > current) { MIN_CRED } else { current - amount };
        
        *table::borrow_mut(&mut registry.cred_scores, user) = new_score;
        
        let new_tier = calculate_visibility_tier(new_score);
        
        event::emit(CredDeducted { user, amount, new_score });
        
        if (old_tier != new_tier) {
            event::emit(VisibilityChanged { user, old_tier, new_tier });
        };
    }

    /// Submit a report against a user
    public fun submit_report(
        registry: &mut ReputationRegistry,
        target: address,
        reason: u8,
        evidence_hash: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ): u64 {
        let reporter = tx_context::sender(ctx);
        assert!(reporter != target, ESelfReport);
        
        ensure_cred_exists(registry, reporter);
        let reporter_cred = *table::borrow(&registry.cred_scores, reporter);
        assert!(reporter_cred >= 50, EInsufficientCred);
        
        let now = clock::timestamp_ms(clock);
        let report_id = registry.report_counter;
        registry.report_counter = report_id + 1;
        
        let report = Report {
            id: report_id,
            reporter,
            target,
            reason,
            evidence_hash,
            created_at: now,
            voting_ends_at: now + VOTING_PERIOD_MS,
            guilty_votes: 0,
            innocent_votes: 0,
            voters: vector::empty(),
            resolved: false,
            resolution: 0,
        };
        
        table::add(&mut registry.reports, report_id, report);
        
        event::emit(ReportSubmitted { report_id, reporter, target, reason });
        
        report_id
    }

    /// Cast a vote on a report (simple direct voting)
    public fun cast_vote(
        registry: &mut ReputationRegistry,
        report_id: u64,
        guilty: bool,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let juror = tx_context::sender(ctx);
        
        ensure_cred_exists(registry, juror);
        let juror_cred = *table::borrow(&registry.cred_scores, juror);
        assert!(juror_cred >= MIN_JUROR_CRED, EInsufficientCred);
        
        assert!(table::contains(&registry.reports, report_id), EReportNotFound);
        let report = table::borrow_mut(&mut registry.reports, report_id);
        
        let now = clock::timestamp_ms(clock);
        assert!(now < report.voting_ends_at, EVotingNotOpen);
        assert!(!report.resolved, EReportAlreadyResolved);
        assert!(!vector::contains(&report.voters, &juror), EAlreadyVoted);
        
        vector::push_back(&mut report.voters, juror);
        if (guilty) {
            report.guilty_votes = report.guilty_votes + 1;
        } else {
            report.innocent_votes = report.innocent_votes + 1;
        };
        
        event::emit(VoteCast { report_id, juror, vote: guilty });
    }

    /// Resolve a report after voting period
    public fun resolve_report(
        registry: &mut ReputationRegistry,
        report_id: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        assert!(table::contains(&registry.reports, report_id), EReportNotFound);
        
        let (target, reason, voting_ends_at, resolved, guilty_votes, innocent_votes) = {
            let report = table::borrow(&registry.reports, report_id);
            (report.target, report.reason, report.voting_ends_at, report.resolved, report.guilty_votes, report.innocent_votes)
        };
        
        let now = clock::timestamp_ms(clock);
        assert!(now >= voting_ends_at, EVotingNotOpen);
        assert!(!resolved, EReportAlreadyResolved);
        
        let resolution = if (guilty_votes > innocent_votes) { 1 } else { 2 };
        let penalty = if (resolution == 1) {
            let penalty_amount = get_penalty_for_reason(reason);
            deduct_cred(registry, target, penalty_amount, ctx);
            penalty_amount
        } else {
            0
        };
        
        let report = table::borrow_mut(&mut registry.reports, report_id);
        report.resolved = true;
        report.resolution = resolution;
        
        event::emit(ReportResolved { report_id, target, resolution, penalty });
    }

    // ========== View Functions ==========

    public fun get_cred_score(registry: &ReputationRegistry, user: address): u64 {
        if (table::contains(&registry.cred_scores, user)) {
            *table::borrow(&registry.cred_scores, user)
        } else {
            STARTING_CRED
        }
    }

    public fun get_visibility_tier(registry: &ReputationRegistry, user: address): u8 {
        let cred = get_cred_score(registry, user);
        calculate_visibility_tier(cred)
    }

    public fun is_suspended(registry: &ReputationRegistry, user: address): bool {
        get_visibility_tier(registry, user) == TIER_SUSPENDED
    }

    public fun can_be_juror(registry: &ReputationRegistry, user: address): bool {
        get_cred_score(registry, user) >= MIN_JUROR_CRED
    }

    public fun get_report_target(registry: &ReputationRegistry, report_id: u64): address {
        let report = table::borrow(&registry.reports, report_id);
        report.target
    }

    public fun is_report_resolved(registry: &ReputationRegistry, report_id: u64): bool {
        let report = table::borrow(&registry.reports, report_id);
        report.resolved
    }

    // ========== Internal Functions ==========

    fun ensure_cred_exists(registry: &mut ReputationRegistry, user: address) {
        if (!table::contains(&registry.cred_scores, user)) {
            table::add(&mut registry.cred_scores, user, STARTING_CRED);
        };
    }

    fun calculate_visibility_tier(cred: u64): u8 {
        if (cred >= CRED_PRISTINE_MIN) { TIER_PRISTINE }
        else if (cred >= CRED_STANDARD_MIN) { TIER_STANDARD }
        else if (cred >= CRED_RESTRICTED_MIN) { TIER_RESTRICTED }
        else if (cred >= CRED_PROBATION_MIN) { TIER_PROBATION }
        else { TIER_SUSPENDED }
    }

    fun get_penalty_for_reason(reason: u8): u64 {
        if (reason == REASON_HARASSMENT) { CRED_PENALTY_SEVERE }
        else if (reason == REASON_NSFW) { CRED_PENALTY_VIOLATION }
        else if (reason == REASON_SPAM) { CRED_PENALTY_WARNING }
        else if (reason == REASON_COPYRIGHT) { CRED_PENALTY_VIOLATION }
        else { CRED_PENALTY_WARNING }
    }

    // ========== Test Helpers ==========
    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
