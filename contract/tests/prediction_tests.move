#[test_only]
module tai::prediction_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use tai::prediction::{Self, Prediction};

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    fun setup_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, ALICE);
        clock::create_for_testing(ts::ctx(scenario))
    }

    #[test]
    fun test_create_prediction() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Will I hit 1000 viewers?"),
                3600000, // 1 hour
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let pred = ts::take_shared<Prediction>(&scenario);
            assert!(prediction::is_open(&pred), 0);
            assert!(prediction::total_pool(&pred) == 0, 1);
            assert!(prediction::creator(&pred) == ALICE, 2);
            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_place_bet() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

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

        // Bob bets YES
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario)); // 10 SUI

            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));

            assert!(prediction::yes_pool(&pred) == 10_000_000_000, 0);
            assert!(prediction::no_pool(&pred) == 0, 1);

            ts::return_shared(pred);
        };

        // Alice bets NO
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(5_000_000_000, ts::ctx(&mut scenario)); // 5 SUI

            prediction::place_bet(&mut pred, false, bet, &clock, ts::ctx(&mut scenario));

            assert!(prediction::yes_pool(&pred) == 10_000_000_000, 0);
            assert!(prediction::no_pool(&pred) == 5_000_000_000, 1);
            assert!(prediction::total_pool(&pred) == 15_000_000_000, 2);

            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_resolve_prediction() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

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

        // Place bets
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario));
            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));
            ts::return_shared(pred);
        };

        // Resolve (creator only)
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);

            prediction::resolve(&mut pred, true, &clock, ts::ctx(&mut scenario)); // YES wins

            assert!(!prediction::is_open(&pred), 0);

            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = prediction::EBettingClosed)]
    fun test_cannot_bet_after_end_time() {
        let mut scenario = ts::begin(ALICE);
        let mut clock = setup_clock(&mut scenario);

        // Create prediction with 1 hour duration
        ts::next_tx(&mut scenario, ALICE);
        {
            prediction::create_and_share(
                std::string::utf8(b"Test prediction"),
                3600000, // 1 hour
                &clock,
                ts::ctx(&mut scenario)
            );
        };

        // Advance clock past end time
        clock::increment_for_testing(&mut clock, 3600001);

        // Try to bet (should fail)
        ts::next_tx(&mut scenario, BOB);
        {
            let mut pred = ts::take_shared<Prediction>(&scenario);
            let bet = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario));

            // This should fail
            prediction::place_bet(&mut pred, true, bet, &clock, ts::ctx(&mut scenario));

            ts::return_shared(pred);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
