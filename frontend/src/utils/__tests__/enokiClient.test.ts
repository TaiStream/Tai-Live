/**
 * Tests for Enoki Client
 */
import { buildSponsorableTransaction, requestSponsorship, executeSponsored } from '../enokiClient';

// Mock Transaction class
jest.mock('@mysten/sui/transactions', () => ({
    Transaction: jest.fn().mockImplementation(() => ({
        build: jest.fn().mockResolvedValue(new Uint8Array([1, 2, 3])),
    })),
}));

describe('enokiClient', () => {
    const mockFetch = global.fetch as jest.Mock;

    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe('requestSponsorship', () => {
        it('should send sponsorship request to backend', async () => {
            const mockResponse = {
                bytes: 'base64-tx-bytes',
                digest: 'tx-digest-123',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const txBytes = new Uint8Array([1, 2, 3]);
            const result = await requestSponsorship(txBytes, 'jwt-token', 'testnet');

            expect(result.bytes).toBe('base64-tx-bytes');
            expect(result.digest).toBe('tx-digest-123');
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/sponsor'),
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Authorization': 'Bearer jwt-token',
                    }),
                })
            );
        });

        it('should throw on sponsorship failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: 'Insufficient balance',
            });

            const txBytes = new Uint8Array([1, 2, 3]);
            await expect(requestSponsorship(txBytes, 'jwt-token')).rejects.toThrow('Sponsorship failed');
        });
    });

    describe('executeSponsored', () => {
        it('should submit signature for execution', async () => {
            const mockResponse = {
                txDigest: 'executed-tx-digest',
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const result = await executeSponsored('digest-123', 'signature-abc', 'jwt-token');

            expect(result.txDigest).toBe('executed-tx-digest');
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('/api/sponsor/digest-123'),
                expect.objectContaining({
                    method: 'POST',
                    body: JSON.stringify({ signature: 'signature-abc' }),
                })
            );
        });

        it('should throw on execution failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: 'Invalid signature',
            });

            await expect(executeSponsored('digest', 'sig', 'jwt')).rejects.toThrow('Execution failed');
        });
    });
});
