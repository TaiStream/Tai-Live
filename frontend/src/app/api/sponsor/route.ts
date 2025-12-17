/**
 * API Route: Sponsor Transactions
 * 
 * Proxies transaction sponsorship requests to Enoki API using private key.
 * 
 * POST /api/sponsor
 * - Body: { network, transactionBlockKindBytes }
 * - Returns: { bytes, digest }
 * 
 * POST /api/sponsor/:digest
 * - Body: { signature }
 * - Returns: { txDigest }
 */

import { NextRequest, NextResponse } from 'next/server';

const ENOKI_API_URL = 'https://api.enoki.mystenlabs.com/v1';
const ENOKI_PRIVATE_KEY = process.env.ENOKI_PRIVATE_API_KEY!;

export async function POST(request: NextRequest) {
    try {
        const jwt = request.headers.get('authorization')?.replace('Bearer ', '');

        if (!jwt) {
            return NextResponse.json({ error: 'Missing authorization' }, { status: 401 });
        }

        const body = await request.json();
        const { network, transactionBlockKindBytes } = body;

        // Call Enoki API to sponsor transaction
        const response = await fetch(`${ENOKI_API_URL}/transaction-blocks/sponsor`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${ENOKI_PRIVATE_KEY}`,
                'zklogin-jwt': jwt,
            },
            body: JSON.stringify({
                network,
                transactionBlockKindBytes,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            return NextResponse.json({ error }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
