/// Module: tipping
/// Direct SUI tips from viewers to streamers
module tai::tipping {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use tai::user_profile::{Self, UserProfile};

    // ========== Error Codes ==========
    const EZeroTip: u64 = 0;
    const ESelfTip: u64 = 1;

    // ========== Events ==========

    public struct TipSent has copy, drop {
        sender: address,
        recipient: address,
        amount: u64,
        sender_profile_id: ID,
        recipient_profile_id: ID,
    }

    // ========== Public Functions ==========

    /// Send a tip in SUI from viewer to streamer
    /// Updates both sender and recipient profile stats
    public fun send_tip(
        sender_profile: &mut UserProfile,
        recipient_profile: &mut UserProfile,
        tip: Coin<SUI>,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&tip);
        let sender = tx_context::sender(ctx);

        // Validate
        assert!(amount > 0, EZeroTip);
        assert!(sender != recipient, ESelfTip);

        // Update profile stats
        user_profile::add_tips_sent(sender_profile, amount);
        user_profile::add_tips_received(recipient_profile, amount);

        // Emit event
        event::emit(TipSent {
            sender,
            recipient,
            amount,
            sender_profile_id: object::id(sender_profile),
            recipient_profile_id: object::id(recipient_profile),
        });

        // Transfer the tip
        transfer::public_transfer(tip, recipient);
    }

    /// Send a tip without profile tracking (for guests)
    public fun send_tip_simple(
        tip: Coin<SUI>,
        recipient: address,
        ctx: &mut TxContext
    ) {
        let amount = coin::value(&tip);
        let sender = tx_context::sender(ctx);

        assert!(amount > 0, EZeroTip);
        assert!(sender != recipient, ESelfTip);

        event::emit(TipSent {
            sender,
            recipient,
            amount,
            sender_profile_id: object::id_from_address(@0x0),
            recipient_profile_id: object::id_from_address(@0x0),
        });

        transfer::public_transfer(tip, recipient);
    }
}
