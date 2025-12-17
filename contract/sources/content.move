/// Module: content
/// VOD content management, pay-per-view, and subscriptions
module tai::content {
    use sui::coin::{Self, Coin};
    use sui::sui::SUI;
    use sui::event;
    use sui::clock::{Self, Clock};
    use std::string::String;
    use tai::user_profile::{Self, UserProfile};

    // ========== Error Codes ==========
    #[allow(unused_const)]
    const ENotOwner: u64 = 0;
    #[allow(unused_const)]
    const EAlreadyPurchased: u64 = 1;
    const EInsufficientPayment: u64 = 2;
    const EContentNotPaid: u64 = 3;
    const EInsufficientTier: u64 = 4;

    // ========== Access Types ==========
    const ACCESS_FREE: u8 = 0;
    const ACCESS_PAID: u8 = 1;
    const ACCESS_TIER_GATED: u8 = 2;
    #[allow(unused_const)]
    const ACCESS_SUBSCRIBER: u8 = 3;

    // ========== Structs ==========

    /// Content object (VOD/recording)
    public struct Content has key, store {
        id: UID,
        owner: address,
        title: String,
        description: String,
        walrus_blob_id: vector<u8>,  // Pointer to Walrus storage
        access_type: u8,
        price: u64,       // In MIST (only for ACCESS_PAID)
        min_tier: u8,     // Only for ACCESS_TIER_GATED
        views: u64,
        revenue: u64,     // Total revenue collected
        created_at: u64,
    }

    /// Purchase receipt (proof of access)
    public struct PurchaseReceipt has key, store {
        id: UID,
        content_id: ID,
        buyer: address,
        amount_paid: u64,
        purchased_at: u64,
    }

    // ========== Events ==========

    public struct ContentPublished has copy, drop {
        content_id: ID,
        owner: address,
        title: String,
        access_type: u8,
        price: u64,
        timestamp: u64,
    }

    public struct ContentPurchased has copy, drop {
        content_id: ID,
        buyer: address,
        amount: u64,
        timestamp: u64,
    }

    public struct ContentViewed has copy, drop {
        content_id: ID,
        viewer: address,
        timestamp: u64,
    }

    // ========== Public Functions ==========

    /// Publish free content
    public fun publish_free(
        title: String,
        description: String,
        walrus_blob_id: vector<u8>,
        clock: &Clock,
        ctx: &mut TxContext
    ): Content {
        let owner = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        let content = Content {
            id: object::new(ctx),
            owner,
            title,
            description,
            walrus_blob_id,
            access_type: ACCESS_FREE,
            price: 0,
            min_tier: 0,
            views: 0,
            revenue: 0,
            created_at: now,
        };

        event::emit(ContentPublished {
            content_id: object::id(&content),
            owner,
            title: content.title,
            access_type: ACCESS_FREE,
            price: 0,
            timestamp: now,
        });

        content
    }

    /// Publish paid content (pay-per-view)
    public fun publish_paid(
        title: String,
        description: String,
        walrus_blob_id: vector<u8>,
        price: u64,
        clock: &Clock,
        ctx: &mut TxContext
    ): Content {
        let owner = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        let content = Content {
            id: object::new(ctx),
            owner,
            title,
            description,
            walrus_blob_id,
            access_type: ACCESS_PAID,
            price,
            min_tier: 0,
            views: 0,
            revenue: 0,
            created_at: now,
        };

        event::emit(ContentPublished {
            content_id: object::id(&content),
            owner,
            title: content.title,
            access_type: ACCESS_PAID,
            price,
            timestamp: now,
        });

        content
    }

    /// Publish tier-gated content
    public fun publish_tier_gated(
        title: String,
        description: String,
        walrus_blob_id: vector<u8>,
        min_tier: u8,
        clock: &Clock,
        ctx: &mut TxContext
    ): Content {
        let owner = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        let content = Content {
            id: object::new(ctx),
            owner,
            title,
            description,
            walrus_blob_id,
            access_type: ACCESS_TIER_GATED,
            price: 0,
            min_tier,
            views: 0,
            revenue: 0,
            created_at: now,
        };

        event::emit(ContentPublished {
            content_id: object::id(&content),
            owner,
            title: content.title,
            access_type: ACCESS_TIER_GATED,
            price: 0,
            timestamp: now,
        });

        content
    }

    /// Purchase access to paid content
    public fun purchase_access(
        content: &mut Content,
        payment: Coin<SUI>,
        clock: &Clock,
        ctx: &mut TxContext
    ): PurchaseReceipt {
        assert!(content.access_type == ACCESS_PAID, EContentNotPaid);

        let amount = coin::value(&payment);
        assert!(amount >= content.price, EInsufficientPayment);

        let buyer = tx_context::sender(ctx);
        let now = clock::timestamp_ms(clock);

        // Update content stats
        content.views = content.views + 1;
        content.revenue = content.revenue + amount;

        // Transfer payment to content owner
        transfer::public_transfer(payment, content.owner);

        // Create receipt
        let receipt = PurchaseReceipt {
            id: object::new(ctx),
            content_id: object::id(content),
            buyer,
            amount_paid: amount,
            purchased_at: now,
        };

        event::emit(ContentPurchased {
            content_id: object::id(content),
            buyer,
            amount,
            timestamp: now,
        });

        receipt
    }

    /// View free or tier-gated content
    public fun view_content(
        content: &mut Content,
        profile: &UserProfile,
        clock: &Clock,
        ctx: &mut TxContext
    ) {
        let viewer = tx_context::sender(ctx);

        // Check access
        if (content.access_type == ACCESS_TIER_GATED) {
            assert!(user_profile::tier(profile) >= content.min_tier, EInsufficientTier);
        };

        content.views = content.views + 1;

        event::emit(ContentViewed {
            content_id: object::id(content),
            viewer,
            timestamp: clock::timestamp_ms(clock),
        });
    }

    // ========== View Functions ==========

    public fun owner(content: &Content): address {
        content.owner
    }

    public fun access_type(content: &Content): u8 {
        content.access_type
    }

    public fun price(content: &Content): u64 {
        content.price
    }

    public fun views(content: &Content): u64 {
        content.views
    }

    public fun revenue(content: &Content): u64 {
        content.revenue
    }
}
