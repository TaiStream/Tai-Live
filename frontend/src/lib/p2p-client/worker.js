"use strict";
// This worker handles the encryption/decryption of media frames
// It runs in a separate thread to avoid blocking the main thread
let currentKey = null;
let currentIV = null;
// AES-GCM configuration
const ALGORITHM = { name: 'AES-GCM', length: 128 };
self.onmessage = async (event) => {
    const { operation, readable, writable, keyBytes, ivBytes } = event.data;
    if (operation === 'setKey') {
        if (keyBytes) {
            currentKey = await crypto.subtle.importKey('raw', keyBytes, ALGORITHM, false, ['encrypt', 'decrypt']);
        }
        if (ivBytes) {
            currentIV = ivBytes;
        }
        return;
    }
    if (operation === 'encrypt') {
        const transformStream = new TransformStream({
            async transform(encodedFrame, controller) {
                if (!currentKey || !currentIV) {
                    // Pass through if no key set (or drop?)
                    controller.enqueue(encodedFrame);
                    return;
                }
                // Create a new IV for each frame (e.g. combine base IV with frame counter or timestamp)
                // For simplicity here we reuse, but in prod we MUST rotate/increment IV
                // A common strategy is IV = base_iv XOR frame_counter
                const iv = new Uint8Array(currentIV);
                // TODO: XOR with frame counter for security
                const data = encodedFrame.data;
                const encryptedData = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, currentKey, data);
                encodedFrame.data = encryptedData;
                controller.enqueue(encodedFrame);
            }
        });
        readable.pipeThrough(transformStream).pipeTo(writable);
    }
    else if (operation === 'decrypt') {
        const transformStream = new TransformStream({
            async transform(encodedFrame, controller) {
                if (!currentKey || !currentIV) {
                    controller.enqueue(encodedFrame);
                    return;
                }
                const iv = new Uint8Array(currentIV);
                // TODO: XOR with frame counter
                try {
                    const data = encodedFrame.data;
                    const decryptedData = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, currentKey, data);
                    encodedFrame.data = decryptedData;
                    controller.enqueue(encodedFrame);
                }
                catch (e) {
                    console.error('Decryption failed', e);
                    // Drop frame
                }
            }
        });
        readable.pipeThrough(transformStream).pipeTo(writable);
    }
};
