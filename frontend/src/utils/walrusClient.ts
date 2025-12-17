/**
 * Walrus Client - Decentralized Storage for VOD
 * 
 * Uses Walrus for storing stream recordings and VOD content.
 * Docs: https://docs.wal.app
 */

// Walrus endpoints
const WALRUS_AGGREGATOR_TESTNET = 'https://aggregator.wal-test.cloud';
const WALRUS_PUBLISHER_TESTNET = 'https://publisher.wal-test.cloud';
const WALRUS_AGGREGATOR_MAINNET = 'https://aggregator.wal.cloud';
const WALRUS_PUBLISHER_MAINNET = 'https://publisher.wal.cloud';

export type WalrusNetwork = 'mainnet' | 'testnet';

export interface WalrusUploadResult {
    blobId: string;
    suiObjectId?: string;
    url: string;
    size: number;
    mediaType: string;
}

export interface WalrusConfig {
    network: WalrusNetwork;
    epochs?: number; // Storage duration in epochs (default: 5)
}

/**
 * Get Walrus endpoints for network
 */
function getEndpoints(network: WalrusNetwork) {
    return {
        aggregator: network === 'mainnet' ? WALRUS_AGGREGATOR_MAINNET : WALRUS_AGGREGATOR_TESTNET,
        publisher: network === 'mainnet' ? WALRUS_PUBLISHER_MAINNET : WALRUS_PUBLISHER_TESTNET,
    };
}

/**
 * Upload a file to Walrus storage
 * 
 * @example
 * ```ts
 * const result = await uploadToWalrus(videoFile, { network: 'testnet' });
 * console.log('Blob ID:', result.blobId);
 * console.log('URL:', result.url);
 * ```
 */
export async function uploadToWalrus(
    file: File | Blob,
    config: WalrusConfig = { network: 'testnet' }
): Promise<WalrusUploadResult> {
    const { publisher, aggregator } = getEndpoints(config.network);
    const epochs = config.epochs || 5;

    // Upload via publisher
    const response = await fetch(`${publisher}/v1/blobs?epochs=${epochs}`, {
        method: 'PUT',
        headers: {
            'Content-Type': file.type || 'application/octet-stream',
        },
        body: file,
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Walrus upload failed: ${error}`);
    }

    const data = await response.json();

    // Handle both newlyCreated and alreadyCertified responses
    const blobInfo = data.newlyCreated?.blobObject || data.alreadyCertified?.blobObject;
    const blobId = blobInfo?.blobId || data.blobId;

    if (!blobId) {
        throw new Error('No blob ID in response');
    }

    return {
        blobId,
        suiObjectId: blobInfo?.id,
        url: `${aggregator}/v1/blobs/${blobId}`,
        size: file.size,
        mediaType: file.type || 'application/octet-stream',
    };
}

/**
 * Get a blob URL from Walrus
 */
export function getWalrusUrl(blobId: string, network: WalrusNetwork = 'testnet'): string {
    const { aggregator } = getEndpoints(network);
    return `${aggregator}/v1/blobs/${blobId}`;
}

/**
 * Download a blob from Walrus
 */
export async function downloadFromWalrus(
    blobId: string,
    network: WalrusNetwork = 'testnet'
): Promise<Blob> {
    const url = getWalrusUrl(blobId, network);
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`Walrus download failed: ${response.statusText}`);
    }

    return response.blob();
}

/**
 * Check if a blob exists in Walrus
 */
export async function blobExists(
    blobId: string,
    network: WalrusNetwork = 'testnet'
): Promise<boolean> {
    const url = getWalrusUrl(blobId, network);

    try {
        const response = await fetch(url, { method: 'HEAD' });
        return response.ok;
    } catch {
        return false;
    }
}

/**
 * Upload stream recording to Walrus and return blob ID for on-chain content
 * 
 * @example
 * ```ts
 * // After stream ends, save recording
 * const recording = await getStreamRecording();
 * const { blobId } = await uploadStreamRecording(recording, 'testnet');
 * 
 * // Use blobId when calling content::publish_paid() on-chain
 * ```
 */
export async function uploadStreamRecording(
    recording: Blob,
    network: WalrusNetwork = 'testnet',
    epochs: number = 10 // Longer storage for VOD
): Promise<WalrusUploadResult> {
    return uploadToWalrus(recording, { network, epochs });
}
