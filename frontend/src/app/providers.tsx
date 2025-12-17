'use client';

import { createNetworkConfig, SuiClientProvider, WalletProvider, useSuiClientContext } from '@mysten/dapp-kit';
import { getFullnodeUrl } from '@mysten/sui/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerEnokiWallets, isEnokiNetwork } from '@mysten/enoki';
import { useEffect } from 'react';
import '@mysten/dapp-kit/dist/index.css';

const { networkConfig } = createNetworkConfig({
    localnet: { url: getFullnodeUrl('localnet') },
    devnet: { url: getFullnodeUrl('devnet') },
    testnet: { url: getFullnodeUrl('testnet') },
    mainnet: { url: getFullnodeUrl('mainnet') },
});

const queryClient = new QueryClient();

// Enoki Configuration from environment variables
const ENOKI_API_KEY = process.env.NEXT_PUBLIC_ENOKI_API_KEY!;
const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID!;
const TWITCH_CLIENT_ID = process.env.NEXT_PUBLIC_TWITCH_CLIENT_ID!;

function RegisterEnokiWallets() {
    const { client, network } = useSuiClientContext();

    useEffect(() => {
        if (!isEnokiNetwork(network)) {
            return;
        }

        const { unregister } = registerEnokiWallets({
            apiKey: ENOKI_API_KEY,
            providers: {
                google: {
                    clientId: GOOGLE_CLIENT_ID,
                },
                twitch: {
                    clientId: TWITCH_CLIENT_ID,
                },
            },
            client: client as any,
            network: 'testnet', // Force testnet to be sure
        });

        return unregister;
    }, [client, network]);

    return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
    return (
        <QueryClientProvider client={queryClient}>
            <SuiClientProvider networks={networkConfig} defaultNetwork="testnet">
                <RegisterEnokiWallets />
                <WalletProvider autoConnect>
                    {children}
                </WalletProvider>
            </SuiClientProvider>
        </QueryClientProvider>
    );
}
