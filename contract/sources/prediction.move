/// Module: prediction
/// Prediction markets for stream outcomes with betting
module tai::prediction {
    use sui::coin::{Self, Coin};
    use sui::balance::{Self, Balance};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    use sui::vec_map::{Self, VecMap};
    use std::string::String;

    // ========== Error Codes ==========
    const ENotCreator: u64 = 0;
    const EBettingClosed: u64 = 1;
    const EAlreadyResolved: u64 = 2;
    const ENotResolved: u64 = 3;
    const ENoBet: u64 = 4;
    const EWrongSide: u64 = 5;
    const EInChallengeWindow: u64 = 6;

    // ========== Constants ==========
    const PLATFORM_FEE_BPS: u64 = 500;  // 5% = 500 basis points
    const CHALLENGE_WINDOW_MS: u64 = 300_000;  // 5 minutes

    // ========== Structs ==========

    /// Prediction market
    public struct Prediction has key {
        id: UID,
        creator: address,
        question: String,
        pool_yes: Balance<SUI>,
        pool_no: Balance<SUI>,
        bets: VecMap<address, Bet>,
        created_at: u64,
        end_time: u64,
        resolution: u8,  // 0=OPEN, 1=YES, 2=NO, 3=CANCELLED
        resolved_at: u64,
        challenge_window_end: u64,
    }

    public struct Bet has store, copy, drop {
        side: bool,  // true = YES, false = NO
        amount: u64,
    }

    // ========== Events ==========

    public struct PredictionCreated has copy, drop {
        prediction_id: ID,
        creator: address,
        question: String,
        end_time: u64,
        timestamp: u64,
    }

    public struct BetPlaced has copy, drop {
        prediction_id: ID,
        bettor: address,
        side: bool,
        amount: u64,
    }

    public struct PredictionResolved has copy, drop {
        prediction_id: ID,
        outcome: u8,
        total_yes: u64,
        total_no: u64,
        platform_fee: u64,
        timestamp: u64,
    }

    public struct WinningsClaimed has copy, drop {
        prediction_id: ID,
        winner: address,
        amount: u64,
    }

    // ========== Public Functions ==========

    /// Create a new prediction
    fun create_prediction(
        question: String,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Prediction {
        let creator = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        let prediction = Prediction {
            id: object::new(ctx),
            creator,
            question,
            pool_yes: balance::zero(),
            pool_no: balance::zero(),
            bets: vec_map::empty(),
            created_at: now,
            end_time: now + duration_ms,
            resolution: 0,  // OPEN
            resolved_at: 0,
            challenge_window_end: 0,
        };

        event::emit(PredictionCreated {
            prediction_id: object::id(&prediction),
            creator,
            question: prediction.question,
            end_time: prediction.end_time,
            timestamp: now,
        });

        prediction
    }

    /// Create and share a prediction
    public fun create_and_share(
        question: String,
        duration_ms: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let prediction = create_prediction(question, duration_ms, clock, ctx);
        transfer::share_object(prediction);
    }

    /// Place a bet on a prediction
    public fun place_bet(
        prediction: &mut Prediction,
        side: bool,  // true = YES, false = NO
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let now = clock::timestamp_ms(clock);
        assert!(now < prediction.end_time, EBettingClosed);
        assert!(prediction.resolution == 0, EAlreadyResolved);

        let bettor = tx_context::sender(ctx);
        let amount = coin::value(&payment);
        let payment_balance = coin::into_balance(payment);

        // Add to appropriate pool
        if (side) {
            balance::join(&mut prediction.pool_yes, payment_balance);
        } else {
            balance::join(&mut prediction.pool_no, payment_balance);
        };

        // Track bet (or add to existing)
        if (vec_map::contains(&prediction.bets, &bettor)) {
            let existing = vec_map::get_mut(&mut prediction.bets, &bettor);
            assert!(existing.side == side, EWrongSide);  // Can only bet on one side
            existing.amount = existing.amount + amount;
        } else {
            vec_map::insert(&mut prediction.bets, bettor, Bet { side, amount });
        };

        event::emit(BetPlaced {
            prediction_id: object::id(prediction),
            bettor,
            side,
            amount,
        });
    }

    /// Resolve the prediction (creator only)
    public fun resolve(
        prediction: &mut Prediction,
        outcome: bool,  // true = YES won, false = NO won
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let caller = tx_context::sender(ctx);
        assert!(caller == prediction.creator, ENotCreator);
        assert!(prediction.resolution == 0, EAlreadyResolved);

        let now = clock::timestamp_ms(clock);

        prediction.resolution = if (outcome) { 1 } else { 2 };
        prediction.resolved_at = now;
        prediction.challenge_window_end = now + CHALLENGE_WINDOW_MS;

        let total_yes = balance::value(&prediction.pool_yes);
        let total_no = balance::value(&prediction.pool_no);
        let losing_pool = if (outcome) { total_no } else { total_yes };
        let platform_fee = (losing_pool * PLATFORM_FEE_BPS) / 10000;

        event::emit(PredictionResolved {
            prediction_id: object::id(prediction),
            outcome: prediction.resolution,
            total_yes,
            total_no,
            platform_fee,
            timestamp: now,
        });
    }

    /// Claim winnings after resolution + challenge window
    public fun claim_winnings(
        prediction: &mut Prediction,
        clock: &Clock,
        ctx: &mut TxContext
    ): Coin<SUI> {
        let now = clock::timestamp_ms(clock);
        assert!(prediction.resolution != 0, ENotResolved);
        assert!(now >= prediction.challenge_window_end, EInChallengeWindow);

        let winner = tx_context::sender(ctx);
        assert!(vec_map::contains(&prediction.bets, &winner), ENoBet);

        let bet = *vec_map::get(&prediction.bets, &winner);
        let winning_side = prediction.resolution == 1;  // 1 = YES won

        assert!(bet.side == winning_side, EWrongSide);

        // Calculate payout
        let total_yes = balance::value(&prediction.pool_yes);
        let total_no = balance::value(&prediction.pool_no);
        let (winning_pool, losing_pool) = if (winning_side) {
            (total_yes, total_no)
        } else {
            (total_no, total_yes)
        };

        // Platform takes 5% of losing pool
        let platform_fee = (losing_pool * PLATFORM_FEE_BPS) / 10000;
        let distributable = losing_pool - platform_fee;

        // Pro-rata share: (user_bet / winning_pool) * distributable + original_bet
        let payout = bet.amount + ((bet.amount * distributable) / winning_pool);

        // Withdraw from appropriate pool
        let payout_balance = if (winning_side) {
            balance::split(&mut prediction.pool_yes, payout)
        } else {
            balance::split(&mut prediction.pool_no, payout)
        };

        // Remove bet to prevent double claim
        vec_map::remove(&mut prediction.bets, &winner);

        let payout_coin = coin::from_balance(payout_balance, ctx);

        event::emit(WinningsClaimed {
            prediction_id: object::id(prediction),
            winner,
            amount: payout,
        });

        payout_coin
    }

    // ========== View Functions ==========

    public fun is_open(prediction: &Prediction): bool {
        prediction.resolution == 0
    }

    public fun total_pool(prediction: &Prediction): u64 {
        balance::value(&prediction.pool_yes) + balance::value(&prediction.pool_no)
    }

    public fun yes_pool(prediction: &Prediction): u64 {
        balance::value(&prediction.pool_yes)
    }

    public fun no_pool(prediction: &Prediction): u64 {
        balance::value(&prediction.pool_no)
    }

    public fun creator(prediction: &Prediction): address {
        prediction.creator
    }
}
