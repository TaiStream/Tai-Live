export interface KeyPair {
    publicKey: Uint8Array;
    secretKey: Uint8Array;
}
export declare class CryptoUtils {
    /**
     * Generate a new keypair for signaling encryption (Box)
     */
    static generateKeyPair(): KeyPair;
    /**
     * Encrypt a message for a specific recipient
     * @param message Plaintext message
     * @param recipientPublicKey Recipient's public key
     * @param senderSecretKey Sender's secret key
     */
    static encryptMessage(message: string, recipientPublicKey: Uint8Array, senderSecretKey: Uint8Array): {
        nonce: Uint8Array;
        ciphertext: Uint8Array;
    };
    /**
     * Decrypt a message from a specific sender
     * @param ciphertext Encrypted message
     * @param nonce Nonce used for encryption
     * @param senderPublicKey Sender's public key
     * @param recipientSecretKey Recipient's secret key
     */
    static decryptMessage(ciphertext: Uint8Array, nonce: Uint8Array, senderPublicKey: Uint8Array, recipientSecretKey: Uint8Array): string | null;
    /**
     * Convert Uint8Array to Base64 string
     */
    static toBase64(data: Uint8Array): string;
    /**
     * Convert Base64 string to Uint8Array
     */
    static fromBase64(data: string): Uint8Array;
}
