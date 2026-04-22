#!/usr/bin/env -S npx tsx
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).crypto = webcrypto;
}

/**
 * Seed a local (surfpool) Solana Space deployment with varied dummy regions,
 * listings, and boosts so the full UI surface is exercised.
 *
 * Uses 5 persistent wallets from scripts/wallets/ (auto-generated on first
 * run, gitignored) so ownership, listings, and boosts come from several
 * accounts — mirroring production more closely than a single-authority seed.
 *
 * Usage (from project root):
 *   # terminal 1
 *   cd solana-space && NO_DNA=1 surfpool start
 *   # terminal 2
 *   npx tsx solana-space/scripts/seed-local.ts
 *   # terminal 3
 *   npm run dev
 *
 * Env:
 *   RPC_URL       default http://127.0.0.1:8899
 *   KEYPAIR_PATH  default ~/.config/solana/id.json
 *   WRITE_ENV=0   skip writing .env.local at repo root (defaults to writing it)
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
  getBase58Decoder,
  lamports,
  type Address,
  type KeyPairSigner,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
import { generateKeyPairSync } from "node:crypto";
import { getInitializeInstructionAsync } from "../clients/js/src/generated/instructions/initialize.js";
import { getMintRegionInstructionAsync } from "../clients/js/src/generated/instructions/mintRegion.js";
import { getCreateListingInstructionAsync } from "../clients/js/src/generated/instructions/createListing.js";
import { getBuyBoostInstructionAsync } from "../clients/js/src/generated/instructions/buyBoost.js";
import { SOLANA_SPACE_PROGRAM_ADDRESS } from "../clients/js/src/generated/programs/solanaSpace.js";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";

const RPC_URL = process.env.RPC_URL ?? "http://127.0.0.1:8899";
const KEYPAIR_PATH =
  process.env.KEYPAIR_PATH ??
  path.join(os.homedir(), ".config", "solana", "id.json");
const WRITE_ENV = process.env.WRITE_ENV !== "0";
const PROJECT_ROOT = path.resolve(__dirname, "..", "..");
const WALLETS_DIR = path.join(PROJECT_ROOT, "scripts", "wallets");
const WALLET_COUNT = 5;
const WALLET_FUND_LAMPORTS = 5_000_000_000n; // 5 SOL per wallet — covers biggest region + boosts + listing rent

const BOOST_HIGHLIGHTED = 1;
const BOOST_GLOWING = 2;
const BOOST_TRENDING = 4;

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
  img?: string;
  link?: string;
  list?: { start: bigint; end: bigint; dur: bigint };
  boost?: number;
  ownerIdx: number; // index into the wallets[] array (0..WALLET_COUNT-1)
}

// Non-overlapping regions distributed across all 5 wallets.
// Listings: 2 decreasing (classic Dutch) + 2 increasing (reverse Dutch — price climbs),
// so both code paths in calculateListingCurrentPrice get exercised.
const REGIONS: Region[] = [
  { x: 10, y: 10, w: 12, h: 8,  img: "https://picsum.photos/seed/1/240/160",  link: "https://solana.com",          boost: BOOST_TRENDING,                                          ownerIdx: 0 },
  { x: 30, y: 15, w: 8,  h: 6,  img: "https://picsum.photos/seed/2/160/120",  link: "https://anchor-lang.com",                                                                     ownerIdx: 1 },
  { x: 50, y: 5,  w: 15, h: 10, img: "https://picsum.photos/seed/3/300/200",                                                                                                       ownerIdx: 2 },
  { x: 75, y: 10, w: 10, h: 8,                                                                                                                                                     ownerIdx: 3 }, // no image — hatched placeholder
  // Decreasing (classic Dutch auction)
  { x: 130, y: 8, w: 20, h: 15, img: "https://picsum.photos/seed/5/400/300",  link: "https://metaplex.com",
    list: { start: 500_000_000n, end: 100_000_000n, dur: 86_400n },                                                                                                                ownerIdx: 4 },
  { x: 170, y: 20, w: 15, h: 25, img: "https://picsum.photos/seed/6/300/500",                                    boost: BOOST_HIGHLIGHTED | BOOST_GLOWING,                         ownerIdx: 0 },
  { x: 70, y: 40, w: 12, h: 10, img: "https://picsum.photos/seed/7/240/200", link: "https://solanabillboard.space",                                                                ownerIdx: 1 },
  // Increasing (reverse Dutch — price climbs over time)
  { x: 90, y: 45, w: 15, h: 12, img: "https://picsum.photos/seed/8/300/240",
    list: { start: 20_000_000n, end: 200_000_000n, dur: 3_600n },                                                                                                                  ownerIdx: 2 },
  { x: 115, y: 50, w: 8, h: 6,                                                                                                                                                     ownerIdx: 3 },
  { x: 5,  y: 40, w: 20, h: 15, img: "https://picsum.photos/seed/10/400/300",                                                                                                      ownerIdx: 4 },
  // Decreasing + triple-boost feature listing
  { x: 140, y: 80, w: 25, h: 20, img: "https://picsum.photos/seed/11/500/400", link: "https://github.com/solana-labs",
    list: { start: 1_000_000_000n, end: 100_000_000n, dur: 7_200n },
    boost: BOOST_HIGHLIGHTED | BOOST_GLOWING | BOOST_TRENDING,                                                                                                                     ownerIdx: 0 },
  // Increasing
  { x: 40, y: 85, w: 30, h: 18, img: "https://picsum.photos/seed/12/600/360", link: "https://github.com",
    list: { start: 50_000_000n, end: 500_000_000n, dur: 86_400n },                                                                                                                 ownerIdx: 1 },
];

async function loadKeypair(p: string): Promise<KeyPairSigner> {
  const raw = fs.readFileSync(p, "utf-8");
  return createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(raw)));
}

// Produce a 64-byte Solana secret key (32-byte Ed25519 seed + 32-byte public key)
// using Node's built-in Ed25519. Mirrors the `solana-keygen`/Keypair file format.
function newSolanaSecretKey(): Uint8Array {
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const privDer = privateKey.export({ format: "der", type: "pkcs8" });
  const pubDer = publicKey.export({ format: "der", type: "spki" });
  // Ed25519 PKCS#8: last 32 bytes are the raw seed.
  // Ed25519 SPKI:   last 32 bytes are the raw public key.
  const out = new Uint8Array(64);
  out.set(privDer.subarray(privDer.length - 32), 0);
  out.set(pubDer.subarray(pubDer.length - 32), 32);
  return out;
}

async function ensureWallets(): Promise<KeyPairSigner[]> {
  fs.mkdirSync(WALLETS_DIR, { recursive: true });
  const wallets: KeyPairSigner[] = [];
  for (let i = 1; i <= WALLET_COUNT; i++) {
    const p = path.join(WALLETS_DIR, `wallet-${i}.json`);
    if (!fs.existsSync(p)) {
      fs.writeFileSync(p, JSON.stringify(Array.from(newSolanaSecretKey())), "utf-8");
      console.log(`  generated ${path.relative(PROJECT_ROOT, p)}`);
    }
    wallets.push(await loadKeypair(p));
  }
  return wallets;
}

type Rpc = ReturnType<typeof createSolanaRpc>;

async function sendTx(
  rpc: Rpc,
  payer: TransactionSigner,
  ixs: Parameters<typeof appendTransactionMessageInstructions>[0],
): Promise<string> {
  const { value: blockhash } = await rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayer(payer.address, m),
    (m) => appendTransactionMessageInstructions(ixs, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(blockhash, m),
  );
  const signed = await signTransactionMessageWithSigners(message);
  const b64 = getBase64EncodedWireTransaction(signed);
  const sig = await rpc.sendTransaction(b64, { encoding: "base64", skipPreflight: true }).send();
  return typeof sig === "string" ? sig : getBase58Decoder().decode(sig);
}

async function confirm(rpc: Rpc, sig: string): Promise<void> {
  for (let i = 0; i < 40; i++) {
    const res = await rpc.getSignatureStatuses([sig as Signature]).send();
    const s = res.value[0];
    if (s?.err)
      throw new Error(
        `tx ${sig} failed: ${JSON.stringify(s.err, (_k, v) =>
          typeof v === "bigint" ? v.toString() : v,
        )}`,
      );
    if (s?.confirmationStatus === "confirmed" || s?.confirmationStatus === "finalized") return;
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`tx ${sig} not confirmed in time`);
}

async function fundWallet(rpc: Rpc, addr: Address, lams: bigint): Promise<void> {
  // requestAirdrop is only on the test-cluster RPC API surface; cast since
  // we're always running against a local validator here.
  const testRpc = rpc as unknown as {
    requestAirdrop: (addr: Address, lams: ReturnType<typeof lamports>) => {
      send: () => Promise<Signature>;
    };
  };
  const sig = await testRpc.requestAirdrop(addr, lamports(lams)).send();
  await confirm(rpc, sig as unknown as string);
}

async function main() {
  console.log("=== Seed Solana Space (localnet / surfpool) ===");
  console.log(`RPC:      ${RPC_URL}`);
  console.log(`Keypair:  ${KEYPAIR_PATH}`);

  const rpc = createSolanaRpc(RPC_URL);
  const authority = await loadKeypair(KEYPAIR_PATH);
  console.log(`Authority: ${authority.address}`);

  const treasury = authority.address as Address;
  const collectionSigner = await generateKeyPairSigner();
  console.log(`Collection: ${collectionSigner.address}`);

  // Load / generate 5 persistent dummy wallets in scripts/wallets/
  console.log();
  console.log("Loading dummy wallets…");
  const wallets = await ensureWallets();
  wallets.forEach((w, i) => console.log(`  wallet-${i + 1}: ${w.address}`));

  // Fund each wallet via faucet so they can pay for their own mints/listings/boosts.
  console.log();
  console.log("Funding wallets via airdrop…");
  for (let i = 0; i < wallets.length; i++) {
    await fundWallet(rpc, wallets[i].address, WALLET_FUND_LAMPORTS);
    console.log(`  ✓ wallet-${i + 1} +${Number(WALLET_FUND_LAMPORTS) / 1e9} SOL`);
  }
  console.log();

  // 1. Initialize canvas + collection (authority pays — only authority can init)
  const initIx = await getInitializeInstructionAsync({
    authority,
    collection: collectionSigner,
    treasury,
    collectionUri: "https://solanabillboard.space/collection.json",
  });
  const initSig = await sendTx(rpc, authority, [initIx]);
  await confirm(rpc, initSig);
  console.log(`✓ initialize  ${initSig.slice(0, 16)}…`);

  // 2. Mint regions — each wallet pays for and owns its assigned regions
  const assets: Array<{ address: Address; region: Region; owner: KeyPairSigner }> = [];
  for (let i = 0; i < REGIONS.length; i++) {
    const r = REGIONS[i];
    const owner = wallets[r.ownerIdx];
    const asset = await generateKeyPairSigner();
    const ix = await getMintRegionInstructionAsync({
      payer: owner,
      asset,
      collection: collectionSigner.address,
      treasury,
      x: r.x,
      y: r.y,
      width: r.w,
      height: r.h,
      imageUri: r.img ?? "",
      link: r.link ?? "",
    });
    const sig = await sendTx(rpc, owner, [ix]);
    await confirm(rpc, sig);
    console.log(
      `✓ mint #${String(i + 1).padStart(2, "0")}  w${r.ownerIdx + 1}  (${r.x},${r.y}) ${r.w}×${r.h}  ${asset.address}`,
    );
    assets.push({ address: asset.address, region: r, owner });
  }

  // 3. Listings — seller is the asset's owner; directions mixed (↑/↓)
  for (const a of assets) {
    if (!a.region.list) continue;
    const { start, end, dur } = a.region.list;
    const ix = await getCreateListingInstructionAsync({
      seller: a.owner,
      asset: a.address,
      collection: collectionSigner.address,
      startPrice: start,
      endPrice: end,
      durationSeconds: dur,
    });
    const sig = await sendTx(rpc, a.owner, [ix]);
    await confirm(rpc, sig);
    const direction = end > start ? "↑" : end < start ? "↓" : "=";
    console.log(`✓ list ${direction} ${a.address.slice(0, 8)}…  ${start} → ${end} over ${dur}s`);
  }

  // 4. Boosts — paid for by the owner
  for (const a of assets) {
    if (!a.region.boost) continue;
    const ix = await getBuyBoostInstructionAsync({
      payer: a.owner,
      asset: a.address,
      collection: collectionSigner.address,
      treasury,
      boostFlags: a.region.boost,
    });
    const sig = await sendTx(rpc, a.owner, [ix]);
    await confirm(rpc, sig);
    const flags: string[] = [];
    if (a.region.boost & BOOST_HIGHLIGHTED) flags.push("HIGHLIGHTED");
    if (a.region.boost & BOOST_GLOWING) flags.push("GLOWING");
    if (a.region.boost & BOOST_TRENDING) flags.push("TRENDING");
    console.log(`✓ boost ${a.address.slice(0, 8)}…  ${flags.join(" | ")}`);
  }

  // 5. Write .env.local for the frontend to pick up
  const wsUrl = RPC_URL.replace(/^http/, "ws").replace(":8899", ":8900");
  if (WRITE_ENV) {
    const envPath = path.join(PROJECT_ROOT, ".env.local");
    const contents =
      `# Auto-generated by solana-space/scripts/seed-local.ts — overrides .env for local dev.\n` +
      `VITE_SOLANA_NETWORK=localnet\n` +
      `VITE_RPC_URL=${RPC_URL}\n` +
      `VITE_WS_URL=${wsUrl}\n` +
      `VITE_PROGRAM_ID=${SOLANA_SPACE_PROGRAM_ADDRESS}\n` +
      `VITE_COLLECTION_ADDRESS=${collectionSigner.address}\n` +
      `VITE_TREASURY=${treasury}\n`;
    fs.writeFileSync(envPath, contents, "utf-8");
    console.log();
    console.log(`Wrote ${envPath}`);
  } else {
    console.log();
    console.log("Add to .env.local:");
    console.log(`  VITE_SOLANA_NETWORK=localnet`);
    console.log(`  VITE_RPC_URL=${RPC_URL}`);
    console.log(`  VITE_WS_URL=${wsUrl}`);
    console.log(`  VITE_PROGRAM_ID=${SOLANA_SPACE_PROGRAM_ADDRESS}`);
    console.log(`  VITE_COLLECTION_ADDRESS=${collectionSigner.address}`);
    console.log(`  VITE_TREASURY=${treasury}`);
  }
  console.log();
  console.log(`=== Seed complete: ${REGIONS.length} regions across ${WALLET_COUNT} wallets ===`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
