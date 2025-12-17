/**
 * Enoki Client Utilities
 * 
 * Provides helpers for:
 * - Sponsored transaction execution (via backend proxy)
 * - User authentication state
 */

import { EnokiClient } from '@mysten/enoki';
import { Transaction } from '@mysten/sui/transactions';
import { SuiClient } from '@mysten/sui/client';

// Backend endpoint for sponsored transactions (proxies to Enoki with private key)
const ENOKI_SPONSOR_ENDPOINT = process.env.NEXT_PUBLIC_ENOKI_SPONSOR_ENDPOINT || '/api/sponsor';

/**
 * Build transaction bytes for sponsorship
 */
export async function buildSponsorableTransaction(
    tx: Transaction,
    client: SuiClient
): Promise<Uint8Array> {
    const transactionBlockKindBytes = await tx.build({
        client,
        onlyTransactionKind: true,
    });
    return transactionBlockKindBytes;
}

/**
 * Request transaction sponsorship from backend
 * Backend will call Enoki API with private key
 */
export async function requestSponsorship(
    transactionBlockKindBytes: Uint8Array,
    jwt: string,
    network: 'testnet' | 'mainnet' = 'testnet'
): Promise<{ bytes: string; digest: string }> {
    const response = await fetch(ENOKI_SPONSOR_ENDPOINT, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({
            network,
            transactionBlockKindBytes: Buffer.from(transactionBlockKindBytes).toString('base64'),
        }),
    });

    if (!response.ok) {
        throw new Error(`Sponsorship failed: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Submit signature for sponsored transaction execution
 */
export async function executeSponsored(
    digest: string,
    signature: string,
    jwt: string
): Promise<{ txDigest: string }> {
    const response = await fetch(`${ENOKI_SPONSOR_ENDPOINT}/${digest}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
        },
        body: JSON.stringify({ signature }),
    });

    if (!response.ok) {
        throw new Error(`Execution failed: ${response.statusText}`);
    }

    return response.json();
}

/**
 * Helper hook usage example:
 * 
 * ```tsx
 * import { useSuiClient, useCurrentWallet, useSignTransaction } from '@mysten/dapp-kit';
 * import { buildSponsorableTransaction, requestSponsorship, executeSponsored } from '@/utils/enokiClient';
 * 
 * async function stakeSponsoredTx(amount: bigint) {
 *   const tx = new Transaction();
 *   tx.moveCall({ ... });
 *   
 *   const bytes = await buildSponsorableTransaction(tx, client);
 *   const { bytes: sponsoredBytes, digest } = await requestSponsorship(bytes, jwt);
 *   const { signature } = await signTransaction({ transaction: sponsoredBytes });
 *   const { txDigest } = await executeSponsored(digest, signature, jwt);
 * }
 * ```
 */
