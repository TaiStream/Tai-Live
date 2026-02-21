/// Module: payment_distribution
/// Handles revenue distribution between streamers and node operators
module tai::payment_distribution {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use sui::object::{Self, ID, UID};
    use sui::tx_context::{Self, TxContext};
    use sui::transfer;
    use sui::table::{Self, Table};

    // ========== Error Codes ==========
    const EInsufficientBalance: u64 = 0;
    const ENotAuthorized: u64 = 1;
    const ENoEarnings: u64 = 2;
    const EInvalidSplit: u64 = 3;

    // ========== Constants ==========
    // Split percentages (basis points, 10000 = 100%)
    const STREAMER_SHARE_BPS: u64 = 9000;     // 90% to streamer
    const NODE_OPERATOR_SHARE_BPS: u64 = 1000; // 10% to node operators
    const BPS_DENOMINATOR: u64 = 10000;

    // ========== Structs ==========

    /// Global treasury for pending distributions
    public struct Treasury has key {
        id: UID,
        /// Accumulated balance for distribution
        balance: Balance<SUI>,
        /// Total distributed to streamers
        total_to_streamers: u64,
        /// Total distributed to node operators
        total_to_operators: u64,
        /// Pending earnings per streamer
        streamer_earnings: Table<address, u64>,
        /// Pending earnings per node operator
        operator_earnings: Table<address, u64>,
    }

    /// Node operator registration
    public struct NodeOperator has key, store {
        id: UID,
        operator: address,
        /// Total streams relayed
        streams_relayed: u64,
        /// Total bytes relayed
        bytes_relayed: u64,
        /// Total earnings withdrawn
        total_withdrawn: u64,
        /// Registration timestamp
        registered_at: u64,
        /// Whether operator is active
        is_active: bool,
    }

    /// Capability to register as node operator
    public struct OperatorCap has key, store {
        id: UID,
        operator_id: ID,
    }

    // ========== Events ==========

    public struct TipReceived has copy, drop {
        stream_id: ID,
        from: address,
        streamer: address,
        relay_node: address,
        total_amount: u64,
        streamer_amount: u64,
        operator_amount: u64,
    }

    public struct EarningsWithdrawn has copy, drop {
        recipient: address,
        amount: u64,
        recipient_type: u8, // 0 = streamer, 1 = operator
    }

    public struct OperatorRegistered has copy, drop {
        operator: address,
        operator_id: ID,
    }

    // ========== Init ==========

    fun init(ctx: &mut TxContext) {
        let treasury = Treasury {
            id: object::new(ctx),
            balance: balance::zero(),
            total_to_streamers: 0,
            total_to_operators: 0,
            streamer_earnings: table::new(ctx),
            operator_earnings: table::new(ctx),
        };
        transfer::share_object(treasury);
    }

    // ========== Public Functions ==========

    /// Process a tip and split between streamer and node operator
    public fun process_tip(
        treasury: &mut Treasury,
        stream_id: ID,
        streamer: address,
        relay_node: address,
        payment: Coin<SUI>,
        _ctx: &mut TxContext
    ) {
        let total_amount = coin::value(&payment);
        assert!(total_amount > 0, EInsufficientBalance);

        // Calculate split
        let streamer_amount = (total_amount * STREAMER_SHARE_BPS) / BPS_DENOMINATOR;
        let operator_amount = total_amount - streamer_amount;

        // Add to treasury balance
        let payment_balance = coin::into_balance(payment);
        balance::join(&mut treasury.balance, payment_balance);

        // Credit streamer earnings
        if (table::contains(&treasury.streamer_earnings, streamer)) {
            let earnings = table::borrow_mut(&mut treasury.streamer_earnings, streamer);
            *earnings = *earnings + streamer_amount;
        } else {
            table::add(&mut treasury.streamer_earnings, streamer, streamer_amount);
        };

        // Credit operator earnings
        if (table::contains(&treasury.operator_earnings, relay_node)) {
            let earnings = table::borrow_mut(&mut treasury.operator_earnings, relay_node);
            *earnings = *earnings + operator_amount;
        } else {
            table::add(&mut treasury.operator_earnings, relay_node, operator_amount);
        };

        treasury.total_to_streamers = treasury.total_to_streamers + streamer_amount;
        treasury.total_to_operators = treasury.total_to_operators + operator_amount;

        event::emit(TipReceived {
            stream_id,
            from: tx_context::sender(_ctx),
            streamer,
            relay_node,
            total_amount,
            streamer_amount,
            operator_amount,
        });
    }

    /// Withdraw streamer earnings
    public fun withdraw_streamer_earnings(
        treasury: &mut Treasury,
        ctx: &mut TxContext
    ): Coin<SUI> {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&treasury.streamer_earnings, sender), ENoEarnings);

        let earnings = table::remove(&mut treasury.streamer_earnings, sender);
        assert!(earnings > 0, ENoEarnings);
        assert!(balance::value(&treasury.balance) >= earnings, EInsufficientBalance);

        event::emit(EarningsWithdrawn {
            recipient: sender,
            amount: earnings,
            recipient_type: 0,
        });

        coin::take(&mut treasury.balance, earnings, ctx)
    }

    /// Withdraw node operator earnings
    public fun withdraw_operator_earnings(
        treasury: &mut Treasury,
        ctx: &mut TxContext
    ): Coin<SUI> {
        let sender = tx_context::sender(ctx);
        assert!(table::contains(&treasury.operator_earnings, sender), ENoEarnings);

        let earnings = table::remove(&mut treasury.operator_earnings, sender);
        assert!(earnings > 0, ENoEarnings);
        assert!(balance::value(&treasury.balance) >= earnings, EInsufficientBalance);

        event::emit(EarningsWithdrawn {
            recipient: sender,
            amount: earnings,
            recipient_type: 1,
        });

        coin::take(&mut treasury.balance, earnings, ctx)
    }

    /// Register as a node operator
    public fun register_operator(
        clock: &sui::clock::Clock,
        ctx: &mut TxContext
    ): (NodeOperator, OperatorCap) {
        let operator_addr = tx_context::sender(ctx);

        let operator = NodeOperator {
            id: object::new(ctx),
            operator: operator_addr,
            streams_relayed: 0,
            bytes_relayed: 0,
            total_withdrawn: 0,
            registered_at: sui::clock::timestamp_ms(clock),
            is_active: true,
        };

        let operator_id = object::id(&operator);

        let cap = OperatorCap {
            id: object::new(ctx),
            operator_id,
        };

        event::emit(OperatorRegistered {
            operator: operator_addr,
            operator_id,
        });

        (operator, cap)
    }

    /// Record relay activity for operator stats
    public fun record_relay_activity(
        operator: &mut NodeOperator,
        cap: &OperatorCap,
        bytes_relayed: u64,
        _ctx: &mut TxContext
    ) {
        assert!(cap.operator_id == object::id(operator), ENotAuthorized);
        operator.streams_relayed = operator.streams_relayed + 1;
        operator.bytes_relayed = operator.bytes_relayed + bytes_relayed;
    }

    /// Deactivate operator
    public fun deactivate_operator(
        operator: &mut NodeOperator,
        cap: &OperatorCap,
        _ctx: &mut TxContext
    ) {
        assert!(cap.operator_id == object::id(operator), ENotAuthorized);
        operator.is_active = false;
    }

    // ========== Entry Wrappers ==========

    /// Entry wrapper: withdraw streamer earnings and transfer to sender
    #[allow(lint(public_entry))]
    public entry fun withdraw_streamer_earnings_entry(
        treasury: &mut Treasury,
        ctx: &mut TxContext
    ) {
        let coin = withdraw_streamer_earnings(treasury, ctx);
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    /// Entry wrapper: withdraw operator earnings and transfer to sender
    #[allow(lint(public_entry))]
    public entry fun withdraw_operator_earnings_entry(
        treasury: &mut Treasury,
        ctx: &mut TxContext
    ) {
        let coin = withdraw_operator_earnings(treasury, ctx);
        transfer::public_transfer(coin, tx_context::sender(ctx));
    }

    // ========== View Functions ==========

    public fun get_streamer_earnings(treasury: &Treasury, streamer: address): u64 {
        if (table::contains(&treasury.streamer_earnings, streamer)) {
            *table::borrow(&treasury.streamer_earnings, streamer)
        } else {
            0
        }
    }

    public fun get_operator_earnings(treasury: &Treasury, operator: address): u64 {
        if (table::contains(&treasury.operator_earnings, operator)) {
            *table::borrow(&treasury.operator_earnings, operator)
        } else {
            0
        }
    }

    public fun get_treasury_stats(treasury: &Treasury): (u64, u64, u64) {
        (
            balance::value(&treasury.balance),
            treasury.total_to_streamers,
            treasury.total_to_operators
        )
    }

    public fun get_operator_stats(operator: &NodeOperator): (u64, u64, bool) {
        (operator.streams_relayed, operator.bytes_relayed, operator.is_active)
    }

    public fun get_split_percentages(): (u64, u64) {
        (STREAMER_SHARE_BPS, NODE_OPERATOR_SHARE_BPS)
    }

    // ========== Test Helpers ==========

    #[test_only]
    public fun init_for_testing(ctx: &mut TxContext) {
        init(ctx);
    }
}
