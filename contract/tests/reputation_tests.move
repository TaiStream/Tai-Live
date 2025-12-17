#[test_only]
module tai::reputation_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self, Clock};
    use tai::reputation::{Self, ReputationRegistry};

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    fun setup_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, ALICE);
        clock::create_for_testing(ts::ctx(scenario))
    }

    fun setup_registry(scenario: &mut Scenario) {
        ts::next_tx(scenario, ALICE);
        reputation::init_for_testing(ts::ctx(scenario));
    }

    #[test]
    fun test_initialize_cred() {
        let mut scenario = ts::begin(ALICE);
        setup_registry(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut registry = ts::take_shared<ReputationRegistry>(&scenario);
            reputation::initialize_cred(&mut registry, ALICE, ts::ctx(&mut scenario));
            
            assert!(reputation::get_cred_score(&registry, ALICE) == 100, 0);
            assert!(reputation::get_visibility_tier(&registry, ALICE) == 0, 1);
            
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_award_cred_caps_at_100() {
        let mut scenario = ts::begin(ALICE);
        setup_registry(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut registry = ts::take_shared<ReputationRegistry>(&scenario);
            reputation::initialize_cred(&mut registry, ALICE, ts::ctx(&mut scenario));
            reputation::award_cred(&mut registry, ALICE, 50, ts::ctx(&mut scenario));
            
            assert!(reputation::get_cred_score(&registry, ALICE) == 100, 0);
            
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_deduct_cred() {
        let mut scenario = ts::begin(ALICE);
        setup_registry(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut registry = ts::take_shared<ReputationRegistry>(&scenario);
            reputation::initialize_cred(&mut registry, BOB, ts::ctx(&mut scenario));
            reputation::deduct_cred(&mut registry, BOB, 20, ts::ctx(&mut scenario));
            
            assert!(reputation::get_cred_score(&registry, BOB) == 80, 0);
            assert!(reputation::get_visibility_tier(&registry, BOB) == 1, 1); // STANDARD
            
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_visibility_tier_thresholds() {
        let mut scenario = ts::begin(ALICE);
        setup_registry(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut registry = ts::take_shared<ReputationRegistry>(&scenario);
            reputation::initialize_cred(&mut registry, ALICE, ts::ctx(&mut scenario));
            
            // PRISTINE (90-100)
            assert!(reputation::get_visibility_tier(&registry, ALICE) == 0, 0);
            
            // STANDARD (70-89)
            reputation::deduct_cred(&mut registry, ALICE, 15, ts::ctx(&mut scenario));
            assert!(reputation::get_visibility_tier(&registry, ALICE) == 1, 1);
            
            // RESTRICTED (50-69)
            reputation::deduct_cred(&mut registry, ALICE, 20, ts::ctx(&mut scenario));
            assert!(reputation::get_visibility_tier(&registry, ALICE) == 2, 2);
            
            // PROBATION (30-49)
            reputation::deduct_cred(&mut registry, ALICE, 20, ts::ctx(&mut scenario));
            assert!(reputation::get_visibility_tier(&registry, ALICE) == 3, 3);
            
            // SUSPENDED (0-29)
            reputation::deduct_cred(&mut registry, ALICE, 20, ts::ctx(&mut scenario));
            assert!(reputation::get_visibility_tier(&registry, ALICE) == 4, 4);
            assert!(reputation::is_suspended(&registry, ALICE), 5);
            
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_cred_floors_at_zero() {
        let mut scenario = ts::begin(ALICE);
        setup_registry(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut registry = ts::take_shared<ReputationRegistry>(&scenario);
            reputation::initialize_cred(&mut registry, BOB, ts::ctx(&mut scenario));
            reputation::deduct_cred(&mut registry, BOB, 150, ts::ctx(&mut scenario));
            
            assert!(reputation::get_cred_score(&registry, BOB) == 0, 0);
            
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    fun test_submit_report() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);
        setup_registry(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut registry = ts::take_shared<ReputationRegistry>(&scenario);
            reputation::initialize_cred(&mut registry, ALICE, ts::ctx(&mut scenario));
            
            let report_id = reputation::submit_report(
                &mut registry,
                BOB,
                1, // HARASSMENT
                b"evidence_hash_123",
                &clock,
                ts::ctx(&mut scenario)
            );
            
            assert!(report_id == 0, 0);
            assert!(reputation::get_report_target(&registry, 0) == BOB, 1);
            assert!(!reputation::is_report_resolved(&registry, 0), 2);
            
            ts::return_shared(registry);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_can_be_juror() {
        let mut scenario = ts::begin(ALICE);
        setup_registry(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut registry = ts::take_shared<ReputationRegistry>(&scenario);
            
            // High cred user can be juror
            reputation::initialize_cred(&mut registry, ALICE, ts::ctx(&mut scenario));
            assert!(reputation::can_be_juror(&registry, ALICE), 0);
            
            // Low cred user cannot
            reputation::deduct_cred(&mut registry, ALICE, 10, ts::ctx(&mut scenario));
            assert!(!reputation::can_be_juror(&registry, ALICE), 1);
            
            ts::return_shared(registry);
        };

        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = reputation::ESelfReport)]
    fun test_cannot_self_report() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);
        setup_registry(&mut scenario);

        ts::next_tx(&mut scenario, ALICE);
        {
            let mut registry = ts::take_shared<ReputationRegistry>(&scenario);
            reputation::initialize_cred(&mut registry, ALICE, ts::ctx(&mut scenario));
            
            reputation::submit_report(
                &mut registry,
                ALICE,
                1,
                b"evidence",
                &clock,
                ts::ctx(&mut scenario)
            );
            
            ts::return_shared(registry);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
