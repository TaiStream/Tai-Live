import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { generateNonce, generateRandomness } from '@mysten/sui/zklogin';
import { jwtDecode } from 'jwt-decode';

const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com'; // TODO: Replace with actual Client ID
const REDIRECT_URI = 'http://localhost:3000/'; // TODO: Update for production

export const setupEphemeralKey = () => {
    const ephemeralKeyPair = new Ed25519Keypair();
    const randomness = generateRandomness();
    const nonce = generateNonce(ephemeralKeyPair.getPublicKey(), 10000, randomness); // 10000 is max epoch, simplified for now

    // Store in session storage to retrieve after redirect
    if (typeof window !== 'undefined') {
        sessionStorage.setItem('ephemeral_key', ephemeralKeyPair.getSecretKey());
        sessionStorage.setItem('zk_randomness', randomness);
    }

    return nonce;
};

export const getGoogleLoginUrl = () => {
    const nonce = setupEphemeralKey();
    const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        response_type: 'id_token',
        redirect_uri: REDIRECT_URI,
        scope: 'openid email profile',
        nonce: nonce,
        state: 'sui_zklogin'
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
};

export const restoreEphemeralKey = (): Ed25519Keypair | null => {
    if (typeof window === 'undefined') return null;
    const privateKey = sessionStorage.getItem('ephemeral_key');
    if (!privateKey) return null;
    return Ed25519Keypair.fromSecretKey(privateKey);
};

export const parseJwt = (token: string) => {
    return jwtDecode(token);
};
