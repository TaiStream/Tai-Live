#[test_only]
module tai::user_profile_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::coin::{Self};
    use sui::sui::SUI;
    use sui::clock::{Self, Clock};
    use tai::user_profile::{Self, UserProfile, AdminCap};

    const ALICE: address = @0xA11CE;
    const ADMIN: address = @0xAD;

    fun setup_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, ALICE);
        clock::create_for_testing(ts::ctx(scenario))
    }

    #[test]
    fun test_create_profile() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            assert!(user_profile::tier(&profile) == 0, 0); // FREE tier
            assert!(user_profile::staked_amount(&profile) == 0, 1);
            assert!(user_profile::total_points(&profile) == 0, 2);
            sui::transfer::public_transfer(profile, ALICE);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_stake_for_audio_tier() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profile
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(profile, ALICE);
        };

        // Stake 1 SUI for AUDIO tier
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(1_000_000_000, ts::ctx(&mut scenario)); // 1 SUI

            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));

            assert!(user_profile::tier(&profile) == 1, 0); // AUDIO tier
            assert!(user_profile::staked_amount(&profile) == 1_000_000_000, 1);

            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_stake_for_video_tier() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profile
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(profile, ALICE);
        };

        // Stake 50 SUI for VIDEO tier
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario)); // 50 SUI

            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));

            assert!(user_profile::tier(&profile) == 3, 0); // VIDEO tier
            assert!(user_profile::staked_amount(&profile) == 50_000_000_000, 1);

            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_unstake() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create and stake
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(profile, ALICE);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(10_000_000_000, ts::ctx(&mut scenario));
            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        // Unstake
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let coin = user_profile::unstake(&mut profile, &clock, ts::ctx(&mut scenario));

            assert!(user_profile::tier(&profile) == 0, 0); // Back to FREE
            assert!(user_profile::staked_amount(&profile) == 0, 1);
            sui::coin::burn_for_testing(coin);

            ts::return_to_sender(&scenario, profile);
            
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_proof_of_fame_access() {
        let mut scenario = ts::begin(ADMIN);
        
        // Init module first (creates AdminCap for ADMIN)
        user_profile::init_for_testing(ts::ctx(&mut scenario));

        let clock = setup_clock(&mut scenario);

        // Create profile for Alice
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(profile, ALICE);
        };

        // Admin grants Proof of Fame (Video Tier = 3)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut profile = ts::take_from_address<UserProfile>(&scenario, ALICE);
            
            user_profile::grant_proof_of_fame(&admin_cap, &mut profile, 3, &clock);
            
            assert!(user_profile::tier(&profile) == 3, 0); // VIDEO tier
            assert!(user_profile::can_create_video_room(&profile), 1);
            
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_to_address(ALICE, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_proof_of_effort_trial() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profile
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(profile, ALICE);
        };

        // Use Proof of Effort (starts trial on Video tier)
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            
            user_profile::grant_proof_of_effort(&mut profile, &clock);
            
            assert!(user_profile::tier(&profile) == 3, 0); // VIDEO tier
            
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_unstake_with_good_engagement_graduates() {
        let mut scenario = ts::begin(ADMIN);
        
        // Init module (creates AdminCap for ADMIN)
        user_profile::init_for_testing(ts::ctx(&mut scenario));

        let clock = setup_clock(&mut scenario);

        // Create profile and stake for VIDEO tier
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(profile, ALICE);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario)); // VIDEO tier
            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        // Admin records 6 passing weeks (graduation threshold)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut profile = ts::take_from_address<UserProfile>(&scenario, ALICE);
            
            // Record 6 passing weeks
            let mut week = 1;
            while (week <= 6) {
                user_profile::record_weekly_metrics(&admin_cap, &mut profile, week, 15, 100, 3000, true);
                week = week + 1;
            };
            
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_to_address(ALICE, profile);
        };

        // Alice unstakes - should keep tier as GRADUATED
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let coin = user_profile::unstake(&mut profile, &clock, ts::ctx(&mut scenario));
            
            assert!(user_profile::tier(&profile) == 3, 0); // Still VIDEO tier
            assert!(user_profile::access_method(&profile) == 3, 1); // ACCESS_GRADUATED
            assert!(user_profile::staked_amount(&profile) == 0, 2);
            sui::coin::burn_for_testing(coin);

            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_unstake_with_no_engagement_drops_to_free() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create and stake (no engagement recorded)
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(profile, ALICE);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario)); // VIDEO tier
            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        // Unstake without any engagement - should drop to FREE
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let coin = user_profile::unstake(&mut profile, &clock, ts::ctx(&mut scenario));
            
            assert!(user_profile::tier(&profile) == 0, 0); // FREE tier
            assert!(user_profile::staked_amount(&profile) == 0, 1);
            sui::coin::burn_for_testing(coin);

            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_revoke_for_inactivity() {
        let mut scenario = ts::begin(ADMIN);
        
        // Init module (creates AdminCap for ADMIN)
        user_profile::init_for_testing(ts::ctx(&mut scenario));

        let clock = setup_clock(&mut scenario);

        // Create profile for Alice
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(profile, ALICE);
        };

        // Admin grants Proof of Fame (gives Video tier trial)
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut profile = ts::take_from_address<UserProfile>(&scenario, ALICE);
            
            user_profile::grant_proof_of_fame(&admin_cap, &mut profile, 3, &clock);
            
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_to_address(ALICE, profile);
        };

        // Admin records 4 consecutive failing weeks
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut profile = ts::take_from_address<UserProfile>(&scenario, ALICE);
            
            user_profile::record_weekly_metrics(&admin_cap, &mut profile, 1, 2, 5, 500, false);
            user_profile::record_weekly_metrics(&admin_cap, &mut profile, 2, 1, 3, 400, false);
            user_profile::record_weekly_metrics(&admin_cap, &mut profile, 3, 0, 0, 0, false);
            user_profile::record_weekly_metrics(&admin_cap, &mut profile, 4, 1, 2, 300, false);
            
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_to_address(ALICE, profile);
        };

        // Admin calls revoke_for_inactivity - should revoke to FREE
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut profile = ts::take_from_address<UserProfile>(&scenario, ALICE);
            
            user_profile::revoke_for_inactivity(&admin_cap, &mut profile, &clock);
            
            assert!(user_profile::tier(&profile) == 0, 0); // FREE tier
            
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_to_address(ALICE, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = user_profile::EHasStakedBalance)]
    fun test_revoke_for_inactivity_fails_if_staked() {
        let mut scenario = ts::begin(ADMIN);
        
        // Init module
        user_profile::init_for_testing(ts::ctx(&mut scenario));

        let clock = setup_clock(&mut scenario);

        // Create and stake
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            sui::transfer::public_transfer(profile, ALICE);
        };

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut profile = ts::take_from_sender<UserProfile>(&scenario);
            let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(&mut scenario));
            user_profile::stake_for_tier(&mut profile, payment, &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        // Try to revoke staked user - should fail
        ts::next_tx(&mut scenario, ADMIN);
        {
            let admin_cap = ts::take_from_sender<AdminCap>(&scenario);
            let mut profile = ts::take_from_address<UserProfile>(&scenario, ALICE);
            
            user_profile::revoke_for_inactivity(&admin_cap, &mut profile, &clock);
            
            ts::return_to_sender(&scenario, admin_cap);
            ts::return_to_address(ALICE, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}

