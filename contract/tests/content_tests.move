#[test_only]
module tai::content_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use tai::user_profile::{Self, UserProfile};
    use tai::content::{Self, Content};

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    fun setup_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, ALICE);
        clock::create_for_testing(ts::ctx(scenario))
    }

    #[test]
    fun test_publish_free_content() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let c = content::publish_free(
                std::string::utf8(b"My Stream Replay"),
                std::string::utf8(b"Epic gaming session"),
                b"walrus_blob_123",
                &clock,
                ts::ctx(&mut scenario)
            );

            assert!(content::owner(&c) == ALICE, 0);
            assert!(content::access_type(&c) == 0, 1); // FREE
            assert!(content::price(&c) == 0, 2);
            assert!(content::views(&c) == 0, 3);

            sui::transfer::public_transfer(c, ALICE);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_publish_paid_content() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let c = content::publish_paid(
                std::string::utf8(b"Premium Tutorial"),
                std::string::utf8(b"Advanced Move development"),
                b"walrus_blob_456",
                5_000_000_000, // 5 SUI
                &clock,
                ts::ctx(&mut scenario)
            );

            assert!(content::access_type(&c) == 1, 0); // PAID
            assert!(content::price(&c) == 5_000_000_000, 1);

            sui::transfer::public_share_object(c);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_purchase_content() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Alice publishes paid content
        ts::next_tx(&mut scenario, ALICE);
        {
            let c = content::publish_paid(
                std::string::utf8(b"Premium Tutorial"),
                std::string::utf8(b"Advanced Move"),
                b"walrus_blob_789",
                5_000_000_000,
                &clock,
                ts::ctx(&mut scenario)
            );
            sui::transfer::public_share_object(c);
        };

        // Bob purchases access
        ts::next_tx(&mut scenario, BOB);
        {
            let mut c = ts::take_shared<Content>(&scenario);
            let payment = coin::mint_for_testing<SUI>(5_000_000_000, ts::ctx(&mut scenario));

            let receipt = content::purchase_access(&mut c, payment, &clock, ts::ctx(&mut scenario));

            assert!(content::views(&c) == 1, 0);
            assert!(content::revenue(&c) == 5_000_000_000, 1);

            sui::transfer::public_transfer(receipt, BOB);
            ts::return_shared(c);
        };

        // Alice should have received payment
        ts::next_tx(&mut scenario, ALICE);
        {
            let coin = ts::take_from_sender<Coin<SUI>>(&scenario);
            assert!(coin::value(&coin) == 5_000_000_000, 0);
            sui::transfer::public_transfer(coin, ALICE);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_tier_gated_content() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profile with VIDEO tier
        ts::next_tx(&mut scenario, BOB);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, BOB);
        };

        ts::next_tx(&mut scenario, BOB);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario));
            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        // Alice publishes tier-gated content (min tier = 3 = VIDEO)
        ts::next_tx(&mut scenario, ALICE);
        {
            let c = content::publish_tier_gated(
                std::string::utf8(b"VIP Content"),
                std::string::utf8(b"For VIDEO tier and above"),
                b"walrus_blob_vip",
                3, // VIDEO tier required
                &clock,
                ts::ctx(&mut scenario)
            );
            sui::transfer::public_share_object(c);
        };

        // Bob (VIDEO tier) can view
        ts::next_tx(&mut scenario, BOB);
        {
            let mut c = ts::take_shared<Content>(&scenario);
            let profile = ts::take_from_sender<UserProfile>(&scenario);

            content::view_content(&mut c, &profile, &clock, ts::ctx(&mut scenario));

            assert!(content::views(&c) == 1, 0);

            ts::return_to_sender(&scenario, profile);
            ts::return_shared(c);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
