#[test_only]
module tai::security_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use tai::user_profile::{Self, UserProfile};
    use tai::room_manager::{Self, Room, RoomConnection};
    use tai::prediction::{Self, Prediction};
    use tai::content::{Self, Content};
    use tai::tipping;

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;
    const CHARLIE: address = @0xC0C;

    fun setup_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, ALICE);
        clock::create_for_testing(ts::ctx(scenario))
    }

    // ========== AUTHORIZATION TESTS ==========

    #[test]
    #[expected_failure(abort_code = room_manager::ENotHost)]
    fun test_non_host_cannot_end_room() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Alice creates profile and room
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, ALICE);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario));
            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

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

        // Bob tries to end Alice's room (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            room_manager::end_room(&mut room, &clock, ts::ctx(&mut scenario));
            ts::return_shared(room);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = prediction::ENotCreator)]
    fun test_non_creator_cannot_resolve_prediction() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

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

        // Bob tries to resolve (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            prediction::resolve(&mut pred, true, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = room_manager::ENotJoined)]
    fun test_cannot_leave_room_with_wrong_connection() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create two rooms
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, ALICE);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario));
            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        // Alice creates first room
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"Room 1"),
                std::string::utf8(b"Gaming"),
                true,
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, profile);
        };

        // Bob joins room
        ts::next_tx(&mut scenario, BOB);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            let connection = room_manager::join_room(&mut room, &clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(connection, BOB);
            ts::return_shared(room);
        };

        // Charlie tries to leave with Bob's connection (should fail)
        ts::next_tx(&mut scenario, CHARLIE);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            let connection = ts::take_from_address<RoomConnection>(&scenario, BOB);
            room_manager::leave_room(&mut room, connection, 100, &clock, ts::ctx(&mut scenario));
            ts::return_shared(room);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== EDGE CASE TESTS ==========

    #[test]
    #[expected_failure(abort_code = tipping::EZeroTip)]
    fun test_cannot_send_zero_tip() {
        let mut scenario = ts::begin(ALICE);

        ts::next_tx(&mut scenario, ALICE);
        {
            let tip = coin::mint_for_testing<SUI>(0, ts::ctx(&mut scenario)); // Zero amount
            tipping::send_tip_simple(tip, BOB, ts::ctx(&mut scenario));
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = user_profile::ENoStakedBalance)]
    fun test_cannot_unstake_with_zero_balance() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profile without staking
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, ALICE);
        };

        // Try to unstake (should fail - no staked balance)
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let unstaked_coin = user_profile::unstake(&mut profile, &clock, ts::ctx(&mut scenario));
            coin::burn_for_testing(unstaked_coin);
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = content::EInsufficientPayment)]
    fun test_cannot_underpay_for_content() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Alice publishes paid content for 10 SUI
        ts::next_tx(&mut scenario, ALICE);
        {
            let c = content::publish_paid(
                std::string::utf8(b"Premium Content"),
                std::string::utf8(b"Description"),
                b"blob_id",
                10_000_000_000, // 10 SUI
                &clock,
                ts::ctx(&mut scenario)
            );
            sui::transfer::public_share_object(c);
        };

        // Bob tries to pay only 5 SUI (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut c = ts::take_shared<Content>(&scenario);
            let payment = coin::mint_for_testing<SUI>(5_000_000_000, ts::ctx(&mut scenario)); // Only 5 SUI
            let receipt = content::purchase_access(&mut c, payment, &clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(receipt, BOB);
            ts::return_shared(c);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = content::EInsufficientTier)]
    fun test_cannot_access_tier_gated_content_without_tier() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Bob creates a FREE tier profile
        ts::next_tx(&mut scenario, BOB);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, BOB);
        };

        // Alice publishes tier-gated content (requires VIDEO tier = 3)
        ts::next_tx(&mut scenario, ALICE);
        {
            let c = content::publish_tier_gated(
                std::string::utf8(b"VIP Content"),
                std::string::utf8(b"For VIDEO tier"),
                b"blob_id",
                3, // VIDEO tier
                &clock,
                ts::ctx(&mut scenario)
            );
            sui::transfer::public_share_object(c);
        };

        // Bob (FREE tier) tries to view (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut c = ts::take_shared<Content>(&scenario);
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            content::view_content(&mut c, &profile, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
            ts::return_shared(c);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== PREDICTION SECURITY TESTS ==========

    #[test]
    #[expected_failure(abort_code = prediction::EAlreadyResolved)]
    fun test_cannot_resolve_twice() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create prediction
        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Test"),
                3600000,
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        // Resolve once
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            prediction::resolve(&mut pred, true, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Try to resolve again (should fail)
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            prediction::resolve(&mut pred, false, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = prediction::EAlreadyResolved)]
    fun test_cannot_bet_after_resolution() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create and resolve prediction
        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Test"),
                3600000,
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            prediction::resolve(&mut pred, true, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Try to bet after resolution (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = prediction::EWrongSide)]
    fun test_cannot_bet_on_both_sides() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create prediction
        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Test"),
                3600000,
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        // Bob bets YES
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Bob tries to also bet NO (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, false, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = prediction::EWrongSide)]
    fun test_loser_cannot_claim_winnings() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = setup_clock(&mut scenario);

        // Create prediction
        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Test"),
                3600000,
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        // Bob bets NO
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, false, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Charlie bets YES
        ts::next_tx(&mut scenario, CHARLIE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Resolve: YES wins
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            prediction::resolve(&mut pred, true, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Advance past challenge window
        clock::increment_for_testing(&mut clock, 400000);

        // Bob (loser) tries to claim (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let coin = prediction::claim_winnings(&mut pred, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
            transfer::public_transfer(coin, BOB);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== ROOM SECURITY TESTS ==========

    #[test]
    #[expected_failure(abort_code = room_manager::ERoomNotLive)]
    fun test_cannot_join_ended_room() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profile and room
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, ALICE);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario));
            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"Stream"),
                std::string::utf8(b"Gaming"),
                true,
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, profile);
        };

        // End the room
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            room_manager::end_room(&mut room, &clock, ts::ctx(&mut scenario));
            ts::return_shared(room);
        };

        // Bob tries to join ended room (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            let connection = room_manager::join_room(&mut room, &clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(connection, BOB);
            ts::return_shared(room);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = room_manager::EAlreadyJoined)]
    fun test_cannot_join_room_twice() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profile and room
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, ALICE);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario));
            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"Stream"),
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
            sui::transfer::public_transfer(connection, BOB);
            ts::return_shared(room);
        };

        // Bob tries to join again (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            let connection = room_manager::join_room(&mut room, &clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(connection, BOB);
            ts::return_shared(room);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
