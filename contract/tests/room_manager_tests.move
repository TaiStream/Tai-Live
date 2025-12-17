#[test_only]
module tai::room_manager_tests {
    use sui::test_scenario::{Self as ts, Scenario};
    use sui::clock::{Self, Clock};
    use tai::user_profile::{Self, UserProfile};
    use tai::room_manager::{Self, Room, RoomConnection};
    use sui::coin;
    use sui::sui::SUI;

    const ALICE: address = @0xA11CE;
    const BOB: address = @0xB0B;

    fun setup_clock(scenario: &mut Scenario): Clock {
        ts::next_tx(scenario, ALICE);
        clock::create_for_testing(ts::ctx(scenario))
    }

    fun create_video_profile(scenario: &mut Scenario, clock: &Clock, addr: address) {
        ts::next_tx(scenario, addr);
        let profile = user_profile::create_profile(clock, ts::ctx(scenario));
        transfer::public_transfer(profile, addr);

        ts::next_tx(scenario, addr);
        let mut profile = ts::take_from_sender<UserProfile>(scenario);
        let payment = coin::mint_for_testing<SUI>(50_000_000_000, ts::ctx(scenario)); // VIDEO tier
        user_profile::stake_for_tier(&mut profile, payment, clock, ts::ctx(scenario));
        ts::return_to_sender(scenario, profile);
    }

    #[test]
    fun test_create_room() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profile with VIDEO tier
        create_video_profile(&mut scenario, &clock, ALICE);

        // Create video room using create_and_share
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"My Stream"),
                std::string::utf8(b"Gaming"),
                true, // video
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, profile);
        };

        // Verify room was created
        ts::next_tx(&mut scenario, ALICE);
        {
            let room = ts::take_shared<Room>(&scenario);
            assert!(room_manager::is_live(&room), 0);
            assert!(room_manager::host(&room) == ALICE, 1);
            assert!(room_manager::connection_count(&room) == 0, 2);
            ts::return_shared(room);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_join_and_leave_room() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create host profile with VIDEO tier
        create_video_profile(&mut scenario, &clock, ALICE);

        // Create room
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"My Stream"),
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

            assert!(room_manager::connection_count(&room) == 1, 0);

            sui::transfer::public_transfer(connection, BOB);
            ts::return_shared(room);
        };

        // Bob leaves room
        ts::next_tx(&mut scenario, BOB);
        {
            let mut room = ts::take_shared<Room>(&scenario);
            let connection = ts::take_from_sender<RoomConnection>(&scenario);

            room_manager::leave_room(&mut room, connection, 600, &clock, ts::ctx(&mut scenario)); // 10 min watched

            ts::return_shared(room);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    fun test_end_room() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        create_video_profile(&mut scenario, &clock, ALICE);

        // Create room
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"My Stream"),
                std::string::utf8(b"Gaming"),
                true,
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, profile);
        };

        // End room
        ts::next_tx(&mut scenario, ALICE);
        {
            let mut room = ts::take_shared<Room>(&scenario);

            room_manager::end_room(&mut room, &clock, ts::ctx(&mut scenario));

            assert!(!room_manager::is_live(&room), 0);

            ts::return_shared(room);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = room_manager::EInsufficientTier)]
    fun test_cannot_create_video_room_without_tier() {
        let mut scenario = ts::begin(ALICE);
        let clock = setup_clock(&mut scenario);

        // Create profile WITHOUT staking (FREE tier)
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = user_profile::create_profile(&clock, ts::ctx(&mut scenario));
            transfer::public_transfer(profile, ALICE);
        };

        // Try to create video room (should fail)
        ts::next_tx(&mut scenario, ALICE);
        {
            let profile = ts::take_from_sender<UserProfile>(&scenario);
            room_manager::create_and_share(
                &profile,
                std::string::utf8(b"My Stream"),
                std::string::utf8(b"Gaming"),
                true, // video
                &clock,
                ts::ctx(&mut scenario)
            );
            ts::return_to_sender(&scenario, profile);
        };

        clock::destroy_for_testing(clock);
        ts::end(scenario);
    }
}
