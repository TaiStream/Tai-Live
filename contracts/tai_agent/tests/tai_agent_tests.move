#[test_only]
module tai_agent::tai_agent_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self, Clock};
    use std::string;
    use sai::agent_registry::{Self, AgentRegistry, AgentIdentity};
    use tai_agent::tai_agent::{Self, TaiAgentProfile};

    const AGENT_OWNER: address = @0xA1;
    const OTHER_USER: address = @0xB1;

    // ========== Helpers ==========

    fun setup_test(): Scenario {
        let mut scenario = ts::begin(AGENT_OWNER);
        {
            agent_registry::init_for_testing(ts::ctx(&mut scenario));
        };
        scenario
    }

    fun create_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, AGENT_OWNER);
        clock::create_for_testing(ts::ctx(scenario))
    }

    fun register_sai_agent(scenario: &mut Scenario, clock: &Clock) {
        ts::next_tx(scenario, AGENT_OWNER);
        {
            let mut registry = ts::take_shared<AgentRegistry>(scenario);
            agent_registry::register_agent(
                &mut registry,
                string::utf8(b"Test Agent"),
                string::utf8(b"https://example.com/agent.json"),
                AGENT_OWNER,
                vector[],
                vector[],
                clock,
                ts::ctx(scenario),
            );
            ts::return_shared(registry);
        };
    }

    fun create_tai_profile(scenario: &mut Scenario, clock: &Clock) {
        ts::next_tx(scenario, AGENT_OWNER);
        {
            let agent = ts::take_shared<AgentIdentity>(scenario);
            tai_agent::create_profile(
                &agent,
                string::utf8(b"robot"),
                0,
                clock,
                ts::ctx(scenario),
            );
            ts::return_shared(agent);
        };
    }

    // ========== Profile Creation Tests ==========

    #[test]
    fun test_create_profile() {
        let mut scenario = setup_test();
        let clock = create_clock(&mut scenario);
        register_sai_agent(&mut scenario, &clock);
        create_tai_profile(&mut scenario, &clock);

        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let profile = ts::take_from_sender<TaiAgentProfile>(&scenario);
            assert!(tai_agent::get_avatar_style(&profile) == string::utf8(b"robot"), 0);
            assert!(tai_agent::get_category(&profile) == 0, 1);
            assert!(tai_agent::get_total_sessions(&profile) == 0, 2);
            assert!(tai_agent::get_last_session_at(&profile) == 0, 3);
            assert!(tai_agent::get_owner(&profile) == AGENT_OWNER, 4);
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1)]
    fun test_create_profile_invalid_category() {
        let mut scenario = setup_test();
        let clock = create_clock(&mut scenario);
        register_sai_agent(&mut scenario, &clock);

        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let agent = ts::take_shared<AgentIdentity>(&scenario);
            tai_agent::create_profile(
                &agent,
                string::utf8(b"robot"),
                10, // invalid
                &clock,
                ts::ctx(&mut scenario),
            );
            ts::return_shared(agent);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== Session Recording Tests ==========

    #[test]
    fun test_record_session() {
        let mut scenario = setup_test();
        let clock = create_clock(&mut scenario);
        register_sai_agent(&mut scenario, &clock);
        create_tai_profile(&mut scenario, &clock);

        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let mut profile = ts::take_from_sender<TaiAgentProfile>(&scenario);

            tai_agent::record_session(&mut profile, b"room-abc-123", &clock, ts::ctx(&mut scenario));
            assert!(tai_agent::get_total_sessions(&profile) == 1, 0);

            tai_agent::record_session(&mut profile, b"room-def-456", &clock, ts::ctx(&mut scenario));
            assert!(tai_agent::get_total_sessions(&profile) == 2, 1);

            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 0)]
    fun test_record_session_not_owner() {
        let mut scenario = setup_test();
        let clock = create_clock(&mut scenario);
        register_sai_agent(&mut scenario, &clock);
        create_tai_profile(&mut scenario, &clock);

        // OTHER_USER tries to record a session on AGENT_OWNER's profile
        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let profile = ts::take_from_sender<TaiAgentProfile>(&scenario);
            transfer::public_transfer(profile, OTHER_USER);
        };

        ts::next_tx(&mut scenario, OTHER_USER);
        {
            let mut profile = ts::take_from_sender<TaiAgentProfile>(&scenario);
            tai_agent::record_session(&mut profile, b"room-123", &clock, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== can_join_room Tests ==========

    #[test]
    fun test_can_join_room() {
        let mut scenario = setup_test();
        let clock = create_clock(&mut scenario);
        register_sai_agent(&mut scenario, &clock);
        create_tai_profile(&mut scenario, &clock);

        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let agent = ts::take_shared<AgentIdentity>(&scenario);
            let profile = ts::take_from_sender<TaiAgentProfile>(&scenario);

            assert!(tai_agent::can_join_room(&agent, &profile), 0);

            ts::return_shared(agent);
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_cannot_join_room_when_deactivated() {
        let mut scenario = setup_test();
        let clock = create_clock(&mut scenario);
        register_sai_agent(&mut scenario, &clock);
        create_tai_profile(&mut scenario, &clock);

        // Deactivate the SAI agent
        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let mut registry = ts::take_shared<AgentRegistry>(&scenario);
            let mut agent = ts::take_shared<AgentIdentity>(&scenario);
            agent_registry::deactivate_agent(&mut registry, &mut agent, &clock, ts::ctx(&mut scenario));
            ts::return_shared(registry);
            ts::return_shared(agent);
        };

        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let agent = ts::take_shared<AgentIdentity>(&scenario);
            let profile = ts::take_from_sender<TaiAgentProfile>(&scenario);

            assert!(!tai_agent::can_join_room(&agent, &profile), 0);

            ts::return_shared(agent);
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    // ========== Setter Tests ==========

    #[test]
    fun test_set_avatar_style() {
        let mut scenario = setup_test();
        let clock = create_clock(&mut scenario);
        register_sai_agent(&mut scenario, &clock);
        create_tai_profile(&mut scenario, &clock);

        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let mut profile = ts::take_from_sender<TaiAgentProfile>(&scenario);
            tai_agent::set_avatar_style(&mut profile, string::utf8(b"anime"), ts::ctx(&mut scenario));
            assert!(tai_agent::get_avatar_style(&profile) == string::utf8(b"anime"), 0);
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_set_category() {
        let mut scenario = setup_test();
        let clock = create_clock(&mut scenario);
        register_sai_agent(&mut scenario, &clock);
        create_tai_profile(&mut scenario, &clock);

        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let mut profile = ts::take_from_sender<TaiAgentProfile>(&scenario);
            tai_agent::set_category(&mut profile, 5, ts::ctx(&mut scenario));
            assert!(tai_agent::get_category(&profile) == 5, 0);
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = 1)]
    fun test_set_category_invalid() {
        let mut scenario = setup_test();
        let clock = create_clock(&mut scenario);
        register_sai_agent(&mut scenario, &clock);
        create_tai_profile(&mut scenario, &clock);

        ts::next_tx(&mut scenario, AGENT_OWNER);
        {
            let mut profile = ts::take_from_sender<TaiAgentProfile>(&scenario);
            tai_agent::set_category(&mut profile, 10, ts::ctx(&mut scenario));
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
