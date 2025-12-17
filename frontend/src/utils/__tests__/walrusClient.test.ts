/**
 * Tests for Walrus Client
 */
import { uploadToWalrus, getWalrusUrl, downloadFromWalrus, blobExists } from '../walrusClient';

describe('walrusClient', () => {
    const mockFetch = global.fetch as jest.Mock;

    beforeEach(() => {
        mockFetch.mockReset();
    });

    describe('uploadToWalrus', () => {
        it('should upload a file and return blob info', async () => {
            const mockResponse = {
                newlyCreated: {
                    blobObject: {
                        blobId: 'test-blob-id-123',
                        id: 'sui-object-id-456',
                    },
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const file = new Blob(['test content'], { type: 'text/plain' });
            const result = await uploadToWalrus(file, { network: 'testnet' });

            expect(result.blobId).toBe('test-blob-id-123');
            expect(result.suiObjectId).toBe('sui-object-id-456');
            expect(result.url).toContain('test-blob-id-123');
            expect(mockFetch).toHaveBeenCalledWith(
                expect.stringContaining('publisher.wal-test.cloud'),
                expect.objectContaining({
                    method: 'PUT',
                    body: file,
                })
            );
        });

        it('should handle already certified blobs', async () => {
            const mockResponse = {
                alreadyCertified: {
                    blobObject: {
                        blobId: 'existing-blob-id',
                    },
                },
            };

            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: () => Promise.resolve(mockResponse),
            });

            const file = new Blob(['duplicate content']);
            const result = await uploadToWalrus(file, { network: 'testnet' });

            expect(result.blobId).toBe('existing-blob-id');
        });

        it('should throw on upload failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                text: () => Promise.resolve('Upload failed'),
            });

            const file = new Blob(['test']);
            await expect(uploadToWalrus(file)).rejects.toThrow('Walrus upload failed');
        });
    });

    describe('getWalrusUrl', () => {
        it('should return testnet URL', () => {
            const url = getWalrusUrl('blob-123', 'testnet');
            expect(url).toBe('https://aggregator.wal-test.cloud/v1/blobs/blob-123');
        });

        it('should return mainnet URL', () => {
            const url = getWalrusUrl('blob-123', 'mainnet');
            expect(url).toBe('https://aggregator.wal.cloud/v1/blobs/blob-123');
        });
    });

    describe('downloadFromWalrus', () => {
        it('should download a blob', async () => {
            const mockBlob = new Blob(['downloaded content']);
            mockFetch.mockResolvedValueOnce({
                ok: true,
                blob: () => Promise.resolve(mockBlob),
            });

            const result = await downloadFromWalrus('blob-123', 'testnet');
            expect(result).toBe(mockBlob);
        });

        it('should throw on download failure', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: false,
                statusText: 'Not Found',
            });

            await expect(downloadFromWalrus('invalid-blob')).rejects.toThrow('Walrus download failed');
        });
    });

    describe('blobExists', () => {
        it('should return true if blob exists', async () => {
            mockFetch.mockResolvedValueOnce({ ok: true });

            const exists = await blobExists('blob-123', 'testnet');
            expect(exists).toBe(true);
            expect(mockFetch).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({ method: 'HEAD' })
            );
        });

        it('should return false if blob does not exist', async () => {
            mockFetch.mockResolvedValueOnce({ ok: false });

            const exists = await blobExists('invalid-blob');
            expect(exists).toBe(false);
        });

        it('should return false on network error', async () => {
            mockFetch.mockRejectedValueOnce(new Error('Network error'));

            const exists = await blobExists('blob-123');
            expect(exists).toBe(false);
        });
    });
});
