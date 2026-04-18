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
  type Address,
  type Signature,
  type TransactionSigner,
} from "@solana/kit";
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
}

// Carefully non-overlapping; mix of curve + center zone; mix of listed / boosted / plain.
const REGIONS: Region[] = [
  { x: 10, y: 10, w: 12, h: 8,  img: "https://picsum.photos/seed/1/240/160",  link: "https://solana.com",           boost: BOOST_TRENDING },
  { x: 30, y: 15, w: 8,  h: 6,  img: "https://picsum.photos/seed/2/160/120",  link: "https://anchor-lang.com" },
  { x: 50, y: 5,  w: 15, h: 10, img: "https://picsum.photos/seed/3/300/200" },
  { x: 75, y: 10, w: 10, h: 8 }, // no image — exercises hatched placeholder
  { x: 130, y: 8, w: 20, h: 15, img: "https://picsum.photos/seed/5/400/300",  link: "https://metaplex.com",
    list: { start: 50_000_000n, end: 10_000_000n, dur: 86_400n } },
  { x: 170, y: 20, w: 15, h: 25, img: "https://picsum.photos/seed/6/300/500", boost: BOOST_HIGHLIGHTED | BOOST_GLOWING },
  { x: 70, y: 40, w: 12, h: 10, img: "https://picsum.photos/seed/7/240/200", link: "https://solanabillboard.space" },
  { x: 90, y: 45, w: 15, h: 12, img: "https://picsum.photos/seed/8/300/240",
    list: { start: 100_000_000n, end: 20_000_000n, dur: 3_600n } },
  { x: 115, y: 50, w: 8, h: 6 }, // no image, no link
  { x: 5,  y: 40, w: 20, h: 15, img: "https://picsum.photos/seed/10/400/300" },
  { x: 140, y: 80, w: 25, h: 20, img: "https://picsum.photos/seed/11/500/400", link: "https://github.com/solana-labs",
    list: { start: 500_000_000n, end: 50_000_000n, dur: 7_200n },
    boost: BOOST_HIGHLIGHTED | BOOST_GLOWING | BOOST_TRENDING },
  { x: 40, y: 85, w: 30, h: 18, img: "https://picsum.photos/seed/12/600/360", link: "https://github.com" },
];

async function loadKeypair(p: string) {
  const raw = fs.readFileSync(p, "utf-8");
  return createKeyPairSignerFromBytes(new Uint8Array(JSON.parse(raw)));
}

type Rpc = ReturnType<typeof createSolanaRpc>;

async function sendTx(rpc: Rpc, payer: TransactionSigner, ixs: Parameters<typeof appendTransactionMessageInstructions>[0]): Promise<string> {
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
  console.log();

  // 1. Initialize canvas + collection
  const initIx = await getInitializeInstructionAsync({
    authority,
    collection: collectionSigner,
    treasury,
    collectionUri: "https://solanabillboard.space/collection.json",
  });
  const initSig = await sendTx(rpc, authority, [initIx]);
  await confirm(rpc, initSig);
  console.log(`✓ initialize  ${initSig.slice(0, 16)}…`);

  // 2. Mint regions (serial — each writes to canvas bitmap)
  const assets: Array<{ address: Address; region: Region }> = [];
  for (let i = 0; i < REGIONS.length; i++) {
    const r = REGIONS[i];
    const asset = await generateKeyPairSigner();
    const ix = await getMintRegionInstructionAsync({
      payer: authority,
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
    const sig = await sendTx(rpc, authority, [ix]);
    await confirm(rpc, sig);
    console.log(`✓ mint #${String(i + 1).padStart(2, "0")}  (${r.x},${r.y}) ${r.w}×${r.h}  ${asset.address}`);
    assets.push({ address: asset.address, region: r });
  }

  // 3. Listings
  for (const a of assets) {
    if (!a.region.list) continue;
    const { start, end, dur } = a.region.list;
    const ix = await getCreateListingInstructionAsync({
      seller: authority,
      asset: a.address,
      collection: collectionSigner.address,
      startPrice: start,
      endPrice: end,
      durationSeconds: dur,
    });
    const sig = await sendTx(rpc, authority, [ix]);
    await confirm(rpc, sig);
    console.log(`✓ list  ${a.address.slice(0, 8)}…  ${start} → ${end} over ${dur}s`);
  }

  // 4. Boosts
  for (const a of assets) {
    if (!a.region.boost) continue;
    const ix = await getBuyBoostInstructionAsync({
      payer: authority,
      asset: a.address,
      collection: collectionSigner.address,
      treasury,
      boostFlags: a.region.boost,
    });
    const sig = await sendTx(rpc, authority, [ix]);
    await confirm(rpc, sig);
    const flags: string[] = [];
    if (a.region.boost & BOOST_HIGHLIGHTED) flags.push("HIGHLIGHTED");
    if (a.region.boost & BOOST_GLOWING) flags.push("GLOWING");
    if (a.region.boost & BOOST_TRENDING) flags.push("TRENDING");
    console.log(`✓ boost ${a.address.slice(0, 8)}…  ${flags.join(" | ")}`);
  }

  // 5. Write the asset-address list to public/seed-assets.json so the frontend
  // can bypass the slow surfpool-proxied getProgramAccounts on localnet.
  const seedManifest = {
    collection: collectionSigner.address,
    assets: assets.map((a) => a.address),
  };
  const seedPath = path.join(PROJECT_ROOT, "public", "seed-assets.json");
  fs.writeFileSync(seedPath, JSON.stringify(seedManifest, null, 2) + "\n", "utf-8");
  console.log(`Wrote ${seedPath}`);

  // 6. Write .env.local for the frontend to pick up
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
  console.log(`=== Seed complete: ${REGIONS.length} regions ===`);
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
