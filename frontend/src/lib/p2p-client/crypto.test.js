"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const crypto_1 = require("./crypto");
const nacl = __importStar(require("tweetnacl"));
describe('CryptoUtils', () => {
    it('should generate valid keypairs', () => {
        const keyPair = crypto_1.CryptoUtils.generateKeyPair();
        expect(keyPair.publicKey).toBeDefined();
        expect(keyPair.secretKey).toBeDefined();
        expect(keyPair.publicKey.length).toBe(nacl.box.publicKeyLength);
        expect(keyPair.secretKey.length).toBe(nacl.box.secretKeyLength);
    });
    it('should encrypt and decrypt messages correctly', () => {
        const sender = crypto_1.CryptoUtils.generateKeyPair();
        const recipient = crypto_1.CryptoUtils.generateKeyPair();
        const message = 'Hello, Privacy!';
        const { nonce, ciphertext } = crypto_1.CryptoUtils.encryptMessage(message, recipient.publicKey, sender.secretKey);
        const decrypted = crypto_1.CryptoUtils.decryptMessage(ciphertext, nonce, sender.publicKey, recipient.secretKey);
        expect(decrypted).toBe(message);
    });
    it('should fail to decrypt with wrong key', () => {
        const sender = crypto_1.CryptoUtils.generateKeyPair();
        const recipient = crypto_1.CryptoUtils.generateKeyPair();
        const attacker = crypto_1.CryptoUtils.generateKeyPair();
        const message = 'Secret Message';
        const { nonce, ciphertext } = crypto_1.CryptoUtils.encryptMessage(message, recipient.publicKey, sender.secretKey);
        const decrypted = crypto_1.CryptoUtils.decryptMessage(ciphertext, nonce, sender.publicKey, attacker.secretKey // Wrong key
        );
        expect(decrypted).toBeNull();
    });
    it('should handle Base64 conversion', () => {
        const data = new Uint8Array([1, 2, 3, 4, 5]);
        const base64 = crypto_1.CryptoUtils.toBase64(data);
        const decoded = crypto_1.CryptoUtils.fromBase64(base64);
        expect(decoded).toEqual(data);
    });
});
