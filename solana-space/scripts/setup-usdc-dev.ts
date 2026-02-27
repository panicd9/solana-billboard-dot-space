#!/usr/bin/env -S npx tsx
// Polyfill Web Crypto for Node 18 (Node 20+ has it globally)
import { webcrypto, createHash, createPrivateKey, createPublicKey } from "node:crypto";
if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}

/**
 * Setup script for Solana Space program.
 *
 * --localnet (default):
 *   Full setup after `surfpool start` — clones USDC-dev mint, funds wallets
 *   via Surfnet cheatcodes, then initializes the program.
 *
 * --devnet:
 *   Airdrops SOL via requestAirdrop, then initializes the program.
 *   USDC-dev mint already exists on devnet — fund via Circle faucet:
 *   https://faucet.circle.com/
 *
 * Wallets funded:
 *   - AZosm5HB5MdUXmG3uCmMMr1A6h5j1wVh3QqSSaFskUim  (local keypair / treasury)
 *   - 7PWXvQBKnr5L6CZMvR5EgbeaniGNhgRxfAq144Nhn5YH  (second wallet)
 *
 * Usage (from project root):
 *   npx tsx solana-space/scripts/setup-usdc-dev.ts              # localnet (default)
 *   npx tsx solana-space/scripts/setup-usdc-dev.ts --localnet   # explicit localnet
 *   npx tsx solana-space/scripts/setup-usdc-dev.ts --devnet     # devnet
 *
 * Env vars (override defaults):
 *   RPC_URL      — defaults based on network flag
 *   KEYPAIR_PATH — defaults to ~/.config/solana/id.json
 */

import {
  pipe,
  createTransactionMessage,
  setTransactionMessageFeePayer,
  appendTransactionMessageInstructions,
  setTransactionMessageLifetimeUsingBlockhash,
  signTransactionMessageWithSigners,
  getBase64EncodedWireTransaction,
  createKeyPairSignerFromBytes,
  createSolanaRpc,
  type Address,
  type Instruction,
  getBase58Decoder,
  getAddressEncoder,
  getProgramDerivedAddress,
} from "@solana/kit";
import { getInitializeInstructionAsync } from "../clients/js/src/generated/instructions/initialize.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

// ── CLI Flags ───────────────────────────────────────────────────────

type Network = "localnet" | "devnet";

function parseNetwork(): Network {
  const args = process.argv.slice(2);
  if (args.includes("--devnet")) return "devnet";
  if (args.includes("--localnet")) return "localnet";
  return "localnet"; // default
}

const NETWORK = parseNetwork();

// ── Config ──────────────────────────────────────────────────────────

const RPC_DEFAULTS: Record<Network, string> = {
  localnet: "http://127.0.0.1:8899",
  devnet: "https://api.devnet.solana.com",
};

const RPC_URL = process.env.RPC_URL || RPC_DEFAULTS[NETWORK];
const KEYPAIR_PATH =
  process.env.KEYPAIR_PATH ??
  path.join(os.homedir(), ".config", "solana", "id.json");

// USDC-dev mint (Circle devnet faucet — same address on devnet and localnet)
const USDC_DEV_MINT = "Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr";

// 20 400 USDC-dev in base units (6 decimals)
const AMOUNT = 20_400 * 10 ** 6; // 20_400_000_000

// Treasury wallet ATA for USDC-dev mint
const TREASURY_WALLET = "AZosm5HB5MdUXmG3uCmMMr1A6h5j1wVh3QqSSaFskUim";
const TREASURY_ATA = "4S5XQkjEEjekgBvvaJf7eiaqs6g8GHtkjt2CA9UQPWWE";

const WALLETS = [
  TREASURY_WALLET,
  "7PWXvQBKnr5L6CZMvR5EgbeaniGNhgRxfAq144Nhn5YH",
  "8xFV3H1xrtCZrSc5ALDXvDZtbPGThEu9wm3f8ua2RSya",
];

// ── Helpers ─────────────────────────────────────────────────────────

interface RpcResponse<T = unknown> {
  jsonrpc: string;
  id: number;
  result?: T;
  error?: { code: number; message: string };
}

async function surfnetRpc<T = unknown>(
  method: string,
  params: unknown
): Promise<T> {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const json = (await res.json()) as RpcResponse<T>;
  if (json.error) {
    throw new Error(`RPC error [${json.error.code}]: ${json.error.message}`);
  }
  return json.result as T;
}

async function loadKeypairSigner(keypairPath: string) {
  const raw = fs.readFileSync(keypairPath, "utf-8");
  const secretKey = new Uint8Array(JSON.parse(raw));
  return createKeyPairSignerFromBytes(secretKey);
}

// PKCS8 DER header for Ed25519 private key (16 bytes)
const PKCS8_HEADER = new Uint8Array([
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06,
  0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
]);

/**
 * Derive a deterministic Ed25519 keypair signer from a seed string.
 * SHA-256(seedString) → 32-byte Ed25519 seed → keypair.
 */
async function deterministicSigner(seedString: string) {
  const seed = createHash("sha256").update(seedString).digest();

  // Import seed as Ed25519 private key via PKCS8
  const pkcs8 = Buffer.concat([PKCS8_HEADER, seed]);
  const privKey = createPrivateKey({ key: pkcs8, format: "der", type: "pkcs8" });

  // Derive public key and export raw 32 bytes (SPKI has 12-byte header)
  const pubKey = createPublicKey(privKey);
  const pubRaw = pubKey.export({ type: "spki", format: "der" }).subarray(12);

  // Solana keypair format: [seed(32), pubkey(32)]
  const keypairBytes = new Uint8Array(64);
  keypairBytes.set(seed, 0);
  keypairBytes.set(pubRaw, 32);

  return createKeyPairSignerFromBytes(keypairBytes);
}

// ── Step 0: Clone USDC-dev mint from devnet ─────────────────────────

const DEVNET_RPC = "https://api.devnet.solana.com";

async function cloneMintFromDevnet() {
  console.log("=== Step 0: Clone USDC-dev Mint from Devnet ===");
  console.log(`Fetching ${USDC_DEV_MINT} from devnet...`);

  const res = await fetch(DEVNET_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getAccountInfo",
      params: [USDC_DEV_MINT, { encoding: "base64" }],
    }),
  });

  const json = (await res.json()) as RpcResponse<{
    value: {
      lamports: number;
      data: [string, string];
      owner: string;
      executable: boolean;
    };
  }>;
  if (json.error) {
    throw new Error(`Devnet RPC error: ${json.error.message}`);
  }
  const acct = json.result!.value;
  if (!acct) {
    throw new Error("USDC-dev mint not found on devnet");
  }

  // Convert base64 account data to hex for surfnet_setAccount
  const dataHex = Buffer.from(acct.data[0], "base64").toString("hex");

  console.log(`  Owner:    ${acct.owner}`);
  console.log(`  Lamports: ${acct.lamports}`);
  console.log(`  Data:     ${acct.data[0].length} bytes (base64)`);

  await surfnetRpc("surfnet_setAccount", [
    USDC_DEV_MINT,
    {
      lamports: acct.lamports,
      data: dataHex,
      owner: acct.owner,
      executable: acct.executable,
    },
  ]);

  console.log("  Injected into Surfnet.");
  console.log();
}

// ── Step 1: Airdrop SOL ─────────────────────────────────────────────

const SOL_AMOUNT = 100 * 1_000_000_000; // 100 SOL in lamports

async function airdropSol() {
  console.log("=== Step 1: Airdrop SOL ===");
  console.log(`Amount: ${SOL_AMOUNT / 1_000_000_000} SOL per wallet`);
  console.log();

  for (const wallet of WALLETS) {
    console.log(`  Setting ${wallet} ...`);

    await surfnetRpc("surfnet_setAccount", [
      wallet,
      { lamports: SOL_AMOUNT },
    ]);

    console.log(`  Done.`);
  }

  console.log();
}

// ── Step 1b: Airdrop SOL via devnet requestAirdrop ──────────────────

const DEVNET_AIRDROP_AMOUNT = 2 * 1_000_000_000; // 2 SOL (devnet max per request)

async function airdropSolDevnet() {
  console.log("=== Step 1: Airdrop SOL (devnet) ===");
  console.log(
    `Amount: ${DEVNET_AIRDROP_AMOUNT / 1_000_000_000} SOL per wallet (devnet limit)`
  );
  console.log();

  const rpc = createSolanaRpc(RPC_URL);

  for (const wallet of WALLETS) {
    console.log(`  Requesting airdrop for ${wallet} ...`);
    try {
      const sig = await rpc
        .requestAirdrop(wallet as Address, BigInt(DEVNET_AIRDROP_AMOUNT))
        .send();
      console.log(`  Signature: ${sig}`);
    } catch (err) {
      console.warn(
        `  Airdrop failed (rate-limited?): ${err instanceof Error ? err.message : err}`
      );
      console.warn(`  Fund manually: solana airdrop 2 ${wallet} --url devnet`);
    }
  }

  console.log();
}

// ── Step 2: Fund USDC-dev token accounts ────────────────────────────

async function setupTokenAccounts() {
  console.log("=== Step 2: Fund USDC-dev Token Accounts ===");
  console.log(`Mint:   ${USDC_DEV_MINT}`);
  console.log(`Amount: ${(AMOUNT / 10 ** 6).toLocaleString()} USDC-dev per wallet`);
  console.log();

  for (const wallet of WALLETS) {
    console.log(`  Setting token account for ${wallet} ...`);

    await surfnetRpc("surfnet_setTokenAccount", [
      wallet,
      USDC_DEV_MINT,
      { amount: AMOUNT, state: "initialized" },
    ]);

    console.log(`  Done.`);
  }

  console.log();
}

// ── Step 2b: Create treasury ATA on devnet ──────────────────────────

const ASSOCIATED_TOKEN_PROGRAM = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL" as Address;
const TOKEN_PROGRAM = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" as Address;
const SYSTEM_PROGRAM = "11111111111111111111111111111111" as Address;

async function deriveAta(owner: Address, mint: Address): Promise<Address> {
  const encoder = getAddressEncoder();
  const [ata] = await getProgramDerivedAddress({
    programAddress: ASSOCIATED_TOKEN_PROGRAM,
    seeds: [encoder.encode(owner), encoder.encode(TOKEN_PROGRAM), encoder.encode(mint)],
  });
  return ata;
}

function createAtaIdempotentInstruction(
  payer: Address,
  ata: Address,
  owner: Address,
  mint: Address
): Instruction {
  return {
    programAddress: ASSOCIATED_TOKEN_PROGRAM,
    accounts: [
      { address: payer, role: 3 /* writable + signer */ },
      { address: ata, role: 1 /* writable */ },
      { address: owner, role: 0 /* readonly */ },
      { address: mint, role: 0 /* readonly */ },
      { address: SYSTEM_PROGRAM, role: 0 /* readonly */ },
      { address: TOKEN_PROGRAM, role: 0 /* readonly */ },
    ],
    data: new Uint8Array([1]), // CreateIdempotent discriminator
  };
}

async function createTreasuryAtaDevnet() {
  console.log("=== Step 2: Create Treasury USDC ATA (devnet) ===");

  const rpc = createSolanaRpc(RPC_URL);
  const payer = await loadKeypairSigner(KEYPAIR_PATH);

  const owner = TREASURY_WALLET as Address;
  const mint = USDC_DEV_MINT as Address;
  const derivedAta = await deriveAta(owner, mint);

  console.log(`  Treasury wallet: ${owner}`);
  console.log(`  USDC mint:       ${mint}`);
  console.log(`  Derived ATA:     ${derivedAta}`);

  if (derivedAta !== TREASURY_ATA) {
    console.warn(`  WARNING: Derived ATA does not match hardcoded TREASURY_ATA (${TREASURY_ATA})`);
  }

  // Check if ATA already exists
  const acctInfo = await rpc.getAccountInfo(derivedAta, { encoding: "base64" }).send();
  if (acctInfo.value) {
    console.log("  ATA already exists, skipping creation.");
    console.log();
    return;
  }

  console.log("  Creating ATA...");
  const ix = createAtaIdempotentInstruction(payer.address, derivedAta, owner, mint);

  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(payer.address, m),
    (m) => appendTransactionMessageInstructions([ix], m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m)
  );

  const signedTx = await signTransactionMessageWithSigners(message);
  const base64Tx = getBase64EncodedWireTransaction(signedTx);
  const signature = await rpc.sendTransaction(base64Tx, { encoding: "base64" }).send();

  const sigStr =
    typeof signature === "string"
      ? signature
      : getBase58Decoder().decode(signature);

  console.log(`  Signature: ${sigStr}`);
  console.log("  Treasury ATA created.");
  console.log();
}

// ── Step 3: Initialize program ──────────────────────────────────────

async function initializeProgram() {
  console.log("=== Step 3: Initialize Program ===");
  console.log(`RPC:      ${RPC_URL}`);
  console.log(`Keypair:  ${KEYPAIR_PATH}`);
  console.log(`USDC:     ${USDC_DEV_MINT}`);
  console.log(`Treasury: ${TREASURY_ATA}`);
  console.log();

  const rpc = createSolanaRpc(RPC_URL);

  const authority = await loadKeypairSigner(KEYPAIR_PATH);
  console.log(`Authority:  ${authority.address}`);

  const collectionSigner = await deterministicSigner("solana-space-collection");
  console.log(`Collection: ${collectionSigner.address}`);
  console.log();

  console.log("Building initialize instruction...");
  const ix = await getInitializeInstructionAsync({
    authority,
    collection: collectionSigner,
    treasury: TREASURY_ATA as Address,
    usdcMint: USDC_DEV_MINT as Address,
    collectionUri: "https://solanabillboard.space/collection.json",
  });

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
  const signature = await rpc
    .sendTransaction(base64Tx, { encoding: "base64" })
    .send();

  const sigStr =
    typeof signature === "string"
      ? signature
      : getBase58Decoder().decode(signature);

  console.log();
  console.log(`Signature:  ${sigStr}`);
  console.log(`Collection: ${collectionSigner.address}`);

  return collectionSigner.address;
}

// ── Main ────────────────────────────────────────────────────────────

async function main() {
  const label = NETWORK === "devnet" ? "Devnet" : "Localnet";
  const envFile = NETWORK === "devnet" ? ".env.devnet" : ".env";

  console.log("============================================================");
  console.log(`  Solana Space — ${label} Setup (USDC-dev)`);
  console.log("============================================================");
  console.log(`  Network: ${NETWORK}`);
  console.log(`  RPC:     ${RPC_URL}`);
  console.log();

  if (NETWORK === "localnet") {
    await cloneMintFromDevnet();
    await airdropSol();
    await setupTokenAccounts();
  } else {
    await airdropSolDevnet();
    await createTreasuryAtaDevnet();
    console.log("  USDC-dev mint already exists on devnet.");
    console.log("  Fund USDC-dev via Circle faucet: https://faucet.circle.com/");
    console.log();
  }

  const collectionAddress = await initializeProgram();

  console.log();
  console.log("============================================================");
  console.log(`  Setup Complete — add to your ${envFile}:`);
  console.log("============================================================");
  console.log();
  console.log(`  VITE_USDC_MINT=${USDC_DEV_MINT}`);
  console.log(`  VITE_TREASURY_USDC_ATA=${TREASURY_ATA}`);
  console.log(`  VITE_COLLECTION_ADDRESS=${collectionAddress}`);
  console.log();
}

main().catch((err) => {
  console.error("Setup failed:", err);
  process.exit(1);
});
