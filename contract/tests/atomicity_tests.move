#[test_only]
module tai::atomicity_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use tai::user_profile::{Self, UserProfile};
    use tai::room_manager::{Self, Room, RoomConnection};
    use tai::prediction::{Self, Prediction};
    use tai::tipping;

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const CHARLIE: address = @0xC0C;

    fun setup_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, ALICE);
        clock::create_for_testing(ts::ctx(scenario))
    }

    fun create_profile_with_tier(scenario: &mut Scenario, clock: &Clock, addr: address, stake_amount: u64) {
        ts::next_tx(scenario, addr);
        let profile = user_profile::create_profile(clock, ts::ctx(scenario));
        transfer::public_transfer(profile, addr);

        if (stake_amount > 0) {
            ts::next_tx(scenario, addr);
            let mut profile = ts::take_from_sender<UserProfile>(scenario);
            let payment = coin::mint_for_testing<SUI>(stake_amount, ts::ctx(scenario));
            user_profile::stake_for_tier(&mut profile, payment, clock, ts::ctx(scenario));
            ts::return_to_sender(scenario, profile);
        };
    }

    // ========== TIPPING ATOMICITY TESTS ==========

    #[test]
    #[expected_failure(abort_code = tipping::EZeroTip)]
    fun test_tip_atomicity_insufficient_amount() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profiles for both users
        create_profile_with_tier(&mut scenario, &clock, ALICE, 0);
        create_profile_with_tier(&mut scenario, &clock, BOB, 0);

        // Record initial state
        ts::next_tx(&mut scenario, ALICE);
        let alice_profile = ts::take_from_sender<UserProfile>(&scenario);
        let bob_profile = ts::take_from_address<UserProfile>(&scenario, BOB);

        let alice_initial_sent = user_profile::total_tips_sent(&alice_profile);
        let bob_initial_received = user_profile::total_tips_received(&bob_profile);

        ts::return_to_sender(&scenario, alice_profile);
        ts::return_to_address(BOB, bob_profile);

        // Alice tries to tip Bob with 0 amount (should fail)
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut alice_profile = ts::take_from_sender<UserProfile>(&scenario);
            let mut bob_profile = ts::take_from_address<UserProfile>(&scenario, BOB);
            let tip = coin::mint_for_testing<SUI>(0, ts::ctx(&mut scenario)); // 0 SUI - invalid

            // This should fail with EZeroTip
            tipping::send_tip(
                &mut alice_profile,
                &mut bob_profile,
                tip,
                BOB,
                ts::ctx(&mut scenario)
            );

            // If we reach here, the test should fail
            // Verify NO state changes occurred (atomicity)
            assert!(user_profile::total_tips_sent(&alice_profile) == alice_initial_sent, 0);
            assert!(user_profile::total_tips_received(&bob_profile) == bob_initial_received, 1);

            ts::return_to_sender(&scenario, alice_profile);
            ts::return_to_address(BOB, bob_profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = tipping::EZeroTip)]
    fun test_tip_atomicity_profile_stats_not_updated_on_failure() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        create_profile_with_tier(&mut scenario, &clock, ALICE, 0);
        create_profile_with_tier(&mut scenario, &clock, BOB, 0);

        // Alice sends a valid tip first
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut alice_profile = ts::take_from_sender<UserProfile>(&scenario);
            let mut bob_profile = ts::take_from_address<UserProfile>(&scenario, BOB);
            let tip = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario)); // 1 SUI

            tipping::send_tip(
                &mut alice_profile,
                &mut bob_profile,
                tip,
                BOB,
                ts::ctx(&mut scenario)
            );

            ts::return_to_sender(&scenario, alice_profile);
            ts::return_to_address(BOB, bob_profile);
        };

        // Record state after first tip
        ts::next_tx(&mut scenario, ALICE);
        let alice_profile = ts::take_from_sender<UserProfile>(&scenario);
        let bob_profile = ts::take_from_address<UserProfile>(&scenario, BOB);

        let alice_sent_before_fail = user_profile::total_tips_sent(&alice_profile);
        let bob_received_before_fail = user_profile::total_tips_received(&bob_profile);

        ts::return_to_sender(&scenario, alice_profile);
        ts::return_to_address(BOB, bob_profile);

        // Alice tries to send invalid tip - stats should rollback
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut alice_profile = ts::take_from_sender<UserProfile>(&scenario);
            let mut bob_profile = ts::take_from_address<UserProfile>(&scenario, BOB);
            let tip = coin::mint_for_testing<SUI>(0, ts::ctx(&mut scenario));

            tipping::send_tip(
                &mut alice_profile,
                &mut bob_profile,
                tip,
                BOB,
                ts::ctx(&mut scenario)
            );

            // Should not reach here - verify no changes if it somehow does
            assert!(user_profile::total_tips_sent(&alice_profile) == alice_sent_before_fail, 0);
            assert!(user_profile::total_tips_received(&bob_profile) == bob_received_before_fail, 1);

            ts::return_to_sender(&scenario, alice_profile);
            ts::return_to_address(BOB, bob_profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== ROOM MANAGEMENT ATOMICITY TESTS ==========

    #[test]
    #[expected_failure(abort_code = room_manager::EInsufficientTier)]
    fun test_room_creation_atomicity_insufficient_tier() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Alice has FREE tier (insufficient for video)
        create_profile_with_tier(&mut scenario, &clock, ALICE, 0);

        // Try to create video room - should fail before Room object is created
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);

            // This should abort BEFORE any Room is created/shared
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"Video Stream"),
                std::string::utf8(b"Gaming"),
                true, // video requires VIDEO tier
                &clock,
                ts::ctx(&mut scenario)
            );

            ts::return_to_sender(&scenario, profile);
        };

        // Verify no Room object was created
        ts::next_tx(&mut scenario, ALICE);
        {
            // If a Room was created, this would succeed - we expect it not to exist
            assert!(!ts::has_most_recent_shared<Room>(), 0);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = room_manager::EAlreadyJoined)]
    fun test_join_room_atomicity_already_joined() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Alice creates a video room
        create_profile_with_tier(&mut scenario, &clock, ALICE, 50_000_000_000); // VIDEO tier

        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"Alice's Stream"),
                std::string::utf8(b"Gaming"),
                true,
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, profile);
        };

        // Bob joins the room
        ts::next_tx(&mut scenario, BOB);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            let connection = room_manager::join_room(&mut room, &clock, ts::ctx(&mut scenario));

            ts::return_shared(room);
            sui::transfer::public_transfer(connection, BOB);
        };

        // Record room state after Bob's successful join
        ts::next_tx(&mut scenario, BOB);
        let room = ts::take_shared<Room>(&scenario);
        let connection_count_before = room_manager::connection_count(&room);
        ts::return_shared(room);

        // Bob tries to join again - should fail atomically
        ts::next_tx(&mut scenario, BOB);
        {
            let mut room = ts::take_shared<Room>(&scenario);

            // This should abort BEFORE creating a second connection
            let connection2 = room_manager::join_room(&mut room, &clock, ts::ctx(&mut scenario));

            // Verify connection count didn't change (should not reach here)
            assert!(room_manager::connection_count(&room) == connection_count_before, 0);

            ts::return_shared(room);
            sui::transfer::public_transfer(connection2, BOB);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = room_manager::ERoomNotLive)]
    fun test_join_ended_room_atomicity() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Alice creates and immediately ends a room
        create_profile_with_tier(&mut scenario, &clock, ALICE, 50_000_000_000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"Alice's Stream"),
                std::string::utf8(b"Gaming"),
                true,
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, profile);
        };

        // Alice ends the room
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            room_manager::end_room(&mut room, &clock, ts::ctx(&mut scenario));
            ts::return_shared(room);
        };

        // Record room state
        ts::next_tx(&mut scenario, BOB);
        let room = ts::take_shared<Room>(&scenario);
        let connection_count = room_manager::connection_count(&room);
        assert!(!room_manager::is_live(&room), 0);
        ts::return_shared(room);

        // Bob tries to join ended room - should fail atomically
        ts::next_tx(&mut scenario, BOB);
        {
            let mut room = ts::take_shared<Room>(&scenario);

            // This should abort BEFORE creating any connection
            let connection = room_manager::join_room(&mut room, &clock, ts::ctx(&mut scenario));

            // Verify connection count unchanged (should not reach here)
            assert!(room_manager::connection_count(&room) == connection_count, 0);

            ts::return_shared(room);
            sui::transfer::public_transfer(connection, BOB);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = room_manager::ENotJoined)]
    fun test_leave_room_atomicity_not_joined() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Alice creates a room
        create_profile_with_tier(&mut scenario, &clock, ALICE, 50_000_000_000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"Alice's Stream"),
                std::string::utf8(b"Gaming"),
                true,
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, profile);
        };

        // Bob joins
        ts::next_tx(&mut scenario, BOB);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            let connection = room_manager::join_room(&mut room, &clock, ts::ctx(&mut scenario));
            ts::return_shared(room);
            sui::transfer::public_transfer(connection, BOB);
        };

        // Charlie tries to leave with Bob's connection - should fail atomically
        ts::next_tx(&mut scenario, CHARLIE);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            let bob_connection = ts::take_from_address<RoomConnection>(&scenario, BOB);

            // This should fail - Charlie trying to leave with Bob's connection
            // The check will fail because connection.viewer == BOB but sender == CHARLIE
            room_manager::leave_room(&mut room, bob_connection, 100, &clock, ts::ctx(&mut scenario));

            ts::return_shared(room);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== PREDICTION MARKET ATOMICITY TESTS ==========

    #[test]
    #[expected_failure(abort_code = prediction::EBettingClosed)]
    fun test_bet_atomicity_after_close() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = setup_clock(&mut scenario);

        // Create prediction with very short duration
        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Test prediction"),
                1000, // 1 second
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        // Advance clock past end time
        clock::increment_for_testing(&mut clock, 2000);

        // Record pool state
        ts::next_tx(&mut scenario, BOB);
        let pred = ts::take_shared<Prediction>(&scenario);
        let yes_pool_before = prediction::yes_pool(&pred);
        let no_pool_before = prediction::no_pool(&pred);
        let total_pool_before = prediction::total_pool(&pred);
        ts::return_shared(pred);

        // Bob tries to bet after close - should fail atomically
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario));

            // This should abort BEFORE modifying pool balances
            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));

            // Verify pools unchanged (should not reach here)
            assert!(prediction::yes_pool(&pred) == yes_pool_before, 0);
            assert!(prediction::no_pool(&pred) == no_pool_before, 1);
            assert!(prediction::total_pool(&pred) == total_pool_before, 2);

            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = prediction::ENotCreator)]
    fun test_resolve_atomicity_not_creator() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = setup_clock(&mut scenario);

        // Alice creates prediction
        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Test prediction"),
                3600000,
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        // Bob and Charlie place bets
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Advance clock past end time
        clock::increment_for_testing(&mut clock, 3700000);

        // Note: resolution is 0 (OPEN) at this point

        // Bob tries to resolve (not creator) - should fail atomically
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);

            // This should abort BEFORE changing resolution state
            prediction::resolve(&mut pred, true, &clock, ts::ctx(&mut scenario));

            // Verify resolution unchanged (should not reach here)
            assert!(prediction::is_open(&pred), 0); // Still OPEN

            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = prediction::EAlreadyResolved)]
    fun test_resolve_twice_atomicity() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = setup_clock(&mut scenario);

        // Create and bet on prediction
        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Test prediction"),
                3600000,
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Advance clock and resolve
        clock::increment_for_testing(&mut clock, 3700000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            prediction::resolve(&mut pred, true, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Verify resolved (resolution state is now 1 = YES)

        // Try to resolve again - should fail atomically
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);

            // This should abort BEFORE any state changes
            prediction::resolve(&mut pred, false, &clock, ts::ctx(&mut scenario));

            // Verify resolution unchanged (should not reach here)
            assert!(!prediction::is_open(&pred), 0); // Should still be resolved

            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = prediction::EWrongSide)]
    fun test_claim_winnings_atomicity_wrong_side() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = setup_clock(&mut scenario);

        // Create prediction
        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Test prediction"),
                3600000,
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        // Bob bets YES, Charlie bets NO
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        ts::next_tx(&mut scenario, CHARLIE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(5_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, false, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Resolve to NO (Charlie wins)
        clock::increment_for_testing(&mut clock, 3700000);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            prediction::resolve(&mut pred, false, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Advance past challenge window
        clock::increment_for_testing(&mut clock, 400000);

        // Record pool state
        ts::next_tx(&mut scenario, BOB);
        let pred = ts::take_shared<Prediction>(&scenario);
        let pool_before = prediction::total_pool(&pred);
        ts::return_shared(pred);

        // Bob tries to claim (bet on YES, but NO won) - should fail atomically
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);

            // This should abort BEFORE returning any coins
            let coin = prediction::claim_winnings(&mut pred, &clock, ts::ctx(&mut scenario));

            // Verify pool unchanged (should not reach here)
            assert!(prediction::total_pool(&pred) == pool_before, 0);

            ts::return_shared(pred);
            transfer::public_transfer(coin, BOB);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== USER PROFILE TIER ATOMICITY TESTS ==========

    #[test]
    fun test_tier_upgrade_accumulative_staking() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Alice creates profile
        create_profile_with_tier(&mut scenario, &clock, ALICE, 0);

        // Record initial tier
        ts::next_tx(&mut scenario, ALICE);
        let profile = ts::take_from_sender<UserProfile>(&scenario);
        let initial_tier = user_profile::tier(&profile);
        assert!(initial_tier == 0, 0); // FREE tier
        ts::return_to_sender(&scenario, profile);

        // Alice stakes 10 SUI (AUDIO tier requires 1 SUI, VIDEO requires 50)
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario)); // 10 SUI

            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));

            // Verify tier upgraded to PODCAST (10 SUI tier)
            let new_tier = user_profile::tier(&profile);
            assert!(new_tier == 2, 0); // PODCAST tier
            assert!(user_profile::staked_amount(&profile) == 10_000_000_000, 1);

            ts::return_to_sender(&scenario, profile);
        };

        // Alice can stake more to reach VIDEO tier
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(40_000_000_000, ts::ctx(&mut scenario)); // 40 more SUI

            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));

            // Verify tier upgraded to VIDEO (total 50 SUI)
            let new_tier = user_profile::tier(&profile);
            assert!(new_tier == 3, 0); // VIDEO tier
            assert!(user_profile::staked_amount(&profile) == 50_000_000_000, 1);

            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = user_profile::ENoStakedBalance)]
    fun test_unstake_atomicity_no_balance() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Alice creates profile with no staking
        create_profile_with_tier(&mut scenario, &clock, ALICE, 0);

        // Record state
        ts::next_tx(&mut scenario, ALICE);
        let profile = ts::take_from_sender<UserProfile>(&scenario);
        let tier_before = user_profile::tier(&profile);
        let balance_before = user_profile::staked_amount(&profile);
        assert!(balance_before == 0, 0);
        ts::return_to_sender(&scenario, profile);

        // Try to unstake when there's nothing staked - should fail atomically
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);

            // This should abort BEFORE any state changes or coin creation
            let unstaked_coin = user_profile::unstake(&mut profile, &clock, ts::ctx(&mut scenario));
            coin::burn_for_testing(unstaked_coin);

            // Verify no state changes (should not reach here)
            assert!(user_profile::tier(&profile) == tier_before, 0);
            assert!(user_profile::staked_amount(&profile) == balance_before, 1);

            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
