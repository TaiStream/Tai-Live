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
exports.CryptoUtils = void 0;
const nacl = __importStar(require("tweetnacl"));
const util = __importStar(require("tweetnacl-util"));
class CryptoUtils {
    /**
     * Generate a new keypair for signaling encryption (Box)
     */
    static generateKeyPair() {
        return nacl.box.keyPair();
    }
    /**
     * Encrypt a message for a specific recipient
     * @param message Plaintext message
     * @param recipientPublicKey Recipient's public key
     * @param senderSecretKey Sender's secret key
     */
    static encryptMessage(message, recipientPublicKey, senderSecretKey) {
        const nonce = nacl.randomBytes(nacl.box.nonceLength);
        const messageBytes = util.decodeUTF8(message);
        const ciphertext = nacl.box(messageBytes, nonce, recipientPublicKey, senderSecretKey);
        return { nonce, ciphertext };
    }
    /**
     * Decrypt a message from a specific sender
     * @param ciphertext Encrypted message
     * @param nonce Nonce used for encryption
     * @param senderPublicKey Sender's public key
     * @param recipientSecretKey Recipient's secret key
     */
    static decryptMessage(ciphertext, nonce, senderPublicKey, recipientSecretKey) {
        const messageBytes = nacl.box.open(ciphertext, nonce, senderPublicKey, recipientSecretKey);
        if (!messageBytes)
            return null;
        return util.encodeUTF8(messageBytes);
    }
    /**
     * Convert Uint8Array to Base64 string
     */
    static toBase64(data) {
        return util.encodeBase64(data);
    }
    /**
     * Convert Base64 string to Uint8Array
     */
    static fromBase64(data) {
        return util.decodeBase64(data);
    }
}
exports.CryptoUtils = CryptoUtils;
