/* eslint-disable */
// One-time setup for 2C2P's Recurring Payment Maintenance API (the
// "unsubscribe" flow in src/lib/2c2p.ts) — it needs an RSA key pair
// separate from TWOC2P_MERCHANT_ID/TWOC2P_SECRET_KEY. Run this once:
//
//   node scripts/generate-2c2p-keys.js
//
// Then:
//   1. Log into the 2C2P merchant portal > Account > Options > Merchant
//      Public Keys, and upload the printed PUBLIC key (x509/SPKI PEM).
//   2. From Account > Options > 2C2P Public Keys, download 2C2P's own
//      public key.
//   3. Set env vars (locally in .env.local, and on Vercel):
//        TWOC2P_MERCHANT_PRIVATE_KEY = the printed PRIVATE key
//        TWOC2P_PUBLIC_KEY           = 2C2P's public key from step 2
//      For multi-line PEM values, replace real newlines with literal \n
//      (same convention as APPLE_PRIVATE_KEY — see .env.example).
//
// The private key never leaves this machine via this script — it's only
// printed to your terminal for you to copy into your own secret storage.

const { generateKeyPairSync } = require("crypto");

const { publicKey, privateKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicKeyEncoding: { type: "spki", format: "pem" },
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
});

console.log("=== Upload this PUBLIC key to 2C2P (Account > Options > Merchant Public Keys) ===\n");
console.log(publicKey);
console.log("=== Keep this PRIVATE key secret — set it as TWOC2P_MERCHANT_PRIVATE_KEY ===\n");
console.log(privateKey);
