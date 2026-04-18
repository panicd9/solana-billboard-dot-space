#!/usr/bin/env -S npx tsx
// Polyfill Web Crypto for Node 18 (Node 20+ has it globally)
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}

/**
 * Initialize the Solana Space program.
 *
 * Creates the CanvasState PDA and Metaplex Core collection.
 *
 * Usage (from project root):
 *   npx tsx solana-space/scripts/initialize.ts
 *
 * Env vars (or pass as CLI args):
 *   RPC_URL          — defaults to http://127.0.0.1:8899
 *   TREASURY         — SOL recipient wallet (defaults to authority pubkey)
 *   KEYPAIR_PATH     — defaults to ~/.config/solana/id.json
 */

import {
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  generateKeyPairSigner,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  type Address,
  getBase58Decoder,
} from "@solana/kit";
import { getInitializeInstructionAsync } from "../clients/js/src/generated/instructions/initialize.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── Config ──────────────────────────────────────────────────────────

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const KEYPAIR_PATH =
  process.env.KEYPAIR_PATH ??
  path.join(os.homedir(), ".config", "solana", "id.json");

// ── Helpers ─────────────────────────────────────────────────────────

async function loadKeypairSigner(keypairPath: string) {
  const raw = fs.readFileSync(keypairPath, "utf-8");
  const secretKey = new Uint8Array(JSON.parse(raw));
  return createKeyPairSignerFromBytes(secretKey);
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log("=== Initialize Solana Space Program ===");
  console.log(`RPC:      ${RPC_URL}`);
  console.log(`Keypair:  ${KEYPAIR_PATH}`);

  const rpc = createSolanaRpc(RPC_URL);

  // Load authority keypair
  const authority = await loadKeypairSigner(KEYPAIR_PATH);
  console.log(`Authority: ${authority.address}`);

  const treasury = (process.env.TREASURY ?? authority.address) as Address;
  console.log(`Treasury: ${treasury}`);

  // Generate fresh keypair for the collection account
  const collectionSigner = await generateKeyPairSigner();
  console.log(`Collection: ${collectionSigner.address}`);
  console.log();

  // Build initialize instruction
  console.log("Building initialize instruction...");
  const ix = await getInitializeInstructionAsync({
    authority,
    collection: collectionSigner,
    treasury,
    collectionUri: "https://solanabillboard.space/collection.json",
  });

  // Build, sign, and send transaction
  console.log("Fetching latest blockhash...");
  const { value: blockhash } = await rpc.getLatestBlockhash().send();

  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(authority.address, m),
    (m) => appendTransactionMessageInstructions([ix], m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m)
  );

  console.log("Signing transaction...");
  const signedTx = await signTransactionMessageWithSigners(message);

  console.log("Sending transaction...");
  const base64Tx = getBase64EncodedWireTransaction(signedTx);
  const signature = await rpc.sendTransaction(base64Tx, { encoding: "base64" }).send();

  const sigStr = typeof signature === "string"
    ? signature
    : getBase58Decoder().decode(signature);

  console.log();
  console.log("=== Initialization Complete ===");
  console.log(`Signature:  ${sigStr}`);
  console.log(`Collection: ${collectionSigner.address}`);
  console.log(`Treasury:   ${treasury}`);
  console.log();
  console.log("Add to your .env:");
  console.log(`  VITE_COLLECTION_ADDRESS=${collectionSigner.address}`);
  console.log(`  VITE_TREASURY=${treasury}`);
}

main().catch((err) => {
  console.error("Initialize failed:", err);
  process.exit(1);
});
