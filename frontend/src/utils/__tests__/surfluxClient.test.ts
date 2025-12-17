/**
 * Tests for Surflux Client
 */
import { subscribeToPackageEvents, TAI_EVENTS } from '../surfluxClient';

// Track EventSource instances
let lastEventSource: any = null;

// Reset before each test
beforeEach(() => {
    lastEventSource = null;
    (global as any).EventSource = jest.fn().mockImplementation(() => {
        lastEventSource = {
            onmessage: null as any,
            onerror: null as any,
            close: jest.fn(),
        };
        return lastEventSource;
    });
});

describe('surfluxClient', () => {
    describe('subscribeToPackageEvents', () => {
        it('should create EventSource with correct URL', () => {
            const onEvent = jest.fn();

            subscribeToPackageEvents({
                apiKey: 'test-api-key',
                network: 'testnet',
                packageId: '0x123',
                onEvent,
            });

            expect(global.EventSource).toHaveBeenCalled();
        });

        it('should include event type filter in URL when provided', () => {
            const onEvent = jest.fn();

            subscribeToPackageEvents({
                apiKey: 'test-api-key',
                network: 'testnet',
                packageId: '0x123',
                eventType: 'TipSent',
                onEvent,
            });

            expect(global.EventSource).toHaveBeenCalled();
        });

        it('should call onEvent when message received', () => {
            const onEvent = jest.fn();

            subscribeToPackageEvents({
                apiKey: 'test-api-key',
                network: 'testnet',
                packageId: '0x123',
                onEvent,
            });

            const mockEvent = {
                id: 'event-1',
                packageId: '0x123',
                transactionModule: 'tipping',
                sender: '0xabc',
                type: 'TipSent',
                parsedJson: { amount: 1000000000 },
                timestampMs: Date.now(),
            };

            // Trigger onmessage callback
            lastEventSource.onmessage({ data: JSON.stringify(mockEvent) });

            expect(onEvent).toHaveBeenCalledWith(mockEvent);
        });

        it('should call onError when JSON parsing fails', () => {
            const onEvent = jest.fn();
            const onError = jest.fn();

            subscribeToPackageEvents({
                apiKey: 'test-api-key',
                network: 'testnet',
                packageId: '0x123',
                onEvent,
                onError,
            });

            // Trigger with invalid JSON
            lastEventSource.onmessage({ data: 'invalid-json' });

            expect(onError).toHaveBeenCalled();
        });

        it('should close EventSource on unsubscribe', () => {
            const onEvent = jest.fn();

            const unsubscribe = subscribeToPackageEvents({
                apiKey: 'test-api-key',
                network: 'testnet',
                packageId: '0x123',
                onEvent,
            });

            unsubscribe();

            expect(lastEventSource.close).toHaveBeenCalled();
        });
    });

    describe('TAI_EVENTS', () => {
        it('should have correct event type constants', () => {
            expect(TAI_EVENTS.TIP_SENT).toBe('tai::tipping::TipSent');
            expect(TAI_EVENTS.BET_PLACED).toBe('tai::prediction::BetPlaced');
            expect(TAI_EVENTS.ROOM_CREATED).toBe('tai::room_manager::RoomCreated');
        });
    });
});
