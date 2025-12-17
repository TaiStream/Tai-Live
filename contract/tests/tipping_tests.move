#[test_only]
module tai::tipping_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use tai::user_profile::{Self, UserProfile};
    use tai::tipping;

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    fun setup_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, ALICE);
        clock::create_for_testing(ts::ctx(scenario))
    }

    #[test]
    fun test_send_tip() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profiles for both users
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, ALICE);
        };

        ts::next_tx(&mut scenario, BOB);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, BOB);
        };

        // Alice tips Bob
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut alice_profile = ts::take_from_sender<UserProfile>(&scenario);
            let mut bob_profile = ts::take_from_address<UserProfile>(&scenario, BOB);
            let tip = coin::mint_for_testing<SUI>(5_000_000_000, ts::ctx(&mut scenario)); // 5 SUI

            tipping::send_tip(
                &mut alice_profile,
                &mut bob_profile,
                tip,
                BOB,
                ts::ctx(&mut scenario)
            );

            assert!(user_profile::total_tips_sent(&alice_profile) == 5_000_000_000, 0);
            assert!(user_profile::total_tips_received(&bob_profile) == 5_000_000_000, 1);

            ts::return_to_sender(&scenario, alice_profile);
            ts::return_to_address(BOB, bob_profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_send_tip_simple() {
        let mut scenario = ts::begin(ALICE);

        // Alice tips Bob without profile tracking
        ts::next_tx(&mut scenario, ALICE);
        {
            let tip = coin::mint_for_testing<SUI>(2_000_000_000, ts::ctx(&mut scenario)); // 2 SUI
            tipping::send_tip_simple(tip, BOB, ts::ctx(&mut scenario));
        };

        // Bob should have received the coin
        ts::next_tx(&mut scenario, BOB);
        {
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&coin) == 2_000_000_000, 0);
            sui::transfer::public_transfer(coin, BOB);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = tipping::ESelfTip)]
    fun test_cannot_tip_self() {
        let mut scenario = ts::begin(ALICE);

        // Try to tip self using simple tip
        ts::next_tx(&mut scenario, ALICE);
        {
            let tip = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario));

            // This should fail
            tipping::send_tip_simple(tip, ALICE, ts::ctx(&mut scenario));
        };

        ts::end(scenario);
    }
}
