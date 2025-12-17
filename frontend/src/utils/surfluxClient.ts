/**
 * Surflux Client - Real-time Sui Event Streaming
 * 
 * Uses Server-Sent Events (SSE) to subscribe to package events.
 * Docs: https://surflux.dev
 */

// Surflux endpoints
const SURFLUX_MAINNET = 'https://flux.surflux.dev';
const SURFLUX_TESTNET = 'https://testnet-flux.surflux.dev';

export type SurfluxNetwork = 'mainnet' | 'testnet';

export interface SurfluxEvent {
    id: string;
    packageId: string;
    transactionModule: string;
    sender: string;
    type: string;
    parsedJson: Record<string, any>;
    timestampMs: number;
}

export interface SurfluxConfig {
    apiKey: string;
    network: SurfluxNetwork;
    packageId: string;
    eventType?: string; // Optional: filter by event type
    onEvent: (event: SurfluxEvent) => void;
    onError?: (error: Error) => void;
}

/**
 * Subscribe to real-time package events via SSE
 * 
 * @example
 * ```ts
 * const unsubscribe = subscribeToPackageEvents({
 *   apiKey: 'your_api_key',
 *   network: 'testnet',
 *   packageId: '0x123...',
 *   eventType: 'TipSent',
 *   onEvent: (event) => {
 *     console.log('Tip received!', event.parsedJson);
 *   }
 * });
 * 
 * // Later: unsubscribe();
 * ```
 */
export function subscribeToPackageEvents(config: SurfluxConfig): () => void {
    const baseUrl = config.network === 'mainnet' ? SURFLUX_MAINNET : SURFLUX_TESTNET;

    const params = new URLSearchParams({
        'api-key': config.apiKey,
        package: config.packageId,
    });

    if (config.eventType) {
        params.set('event-type', config.eventType);
    }

    const url = `${baseUrl}/v1/streams/package-events?${params.toString()}`;

    const eventSource = new EventSource(url);

    eventSource.onmessage = (event) => {
        try {
            const data = JSON.parse(event.data) as SurfluxEvent;
            config.onEvent(data);
        } catch (error) {
            config.onError?.(error as Error);
        }
    };

    eventSource.onerror = (error) => {
        config.onError?.(new Error('SSE connection error'));
    };

    // Return unsubscribe function
    return () => {
        eventSource.close();
    };
}

/**
 * React hook for subscribing to Surflux events
 */
export function useSurfluxEvents(
    packageId: string | undefined,
    eventType: string,
    onEvent: (event: SurfluxEvent) => void
) {
    // Note: Implementation requires useEffect wrapper in component
    // See LiveChat.tsx for usage example
}

// Event type constants for Tai contracts
export const TAI_EVENTS = {
    TIP_SENT: 'tai::tipping::TipSent',
    BET_PLACED: 'tai::prediction::BetPlaced',
    PREDICTION_RESOLVED: 'tai::prediction::PredictionResolved',
    ROOM_CREATED: 'tai::room_manager::RoomCreated',
    ROOM_ENDED: 'tai::room_manager::RoomEnded',
    CONTENT_PUBLISHED: 'tai::content::ContentPublished',
} as const;
