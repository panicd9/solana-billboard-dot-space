import {
  getProgramDerivedAddress,
  getAddressEncoder,
  getUtf8Encoder,
  fetchEncodedAccounts,
  type Address,
  createSolanaRpc,
  createSolanaRpcSubscriptions,
} from "@solana/kit";
import {
  fetchMaybeCanvasState,
  fetchMaybeListing,
  fetchMaybeBoosts,
  fetchAllMaybeListing,
  decodeBoosts,
  type Listing,
  type Boosts,
} from "@/generated/accounts";
import type { MaybeAccount } from "@solana/kit";
import { PROGRAM_ID, GRID_WIDTH } from "./constants";
import { config } from "@/config/env";

// ---- RPC singleton ----

let rpcInstance: ReturnType<typeof createSolanaRpc> | null = null;

export function getRpc() {
  if (!rpcInstance) {
    rpcInstance = createSolanaRpc(config.rpcUrl);
  }
  return rpcInstance;
}

let rpcSubsInstance: ReturnType<typeof createSolanaRpcSubscriptions> | null =
  null;

export function getRpcSubscriptions() {
  if (!rpcSubsInstance) {
    rpcSubsInstance = createSolanaRpcSubscriptions(config.wsUrl);
  }
  return rpcSubsInstance;
}

// ---- PDA derivation ----

export async function getCanvasStatePda(): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [getUtf8Encoder().encode("canvas")],
  });
  return address;
}

export async function getListingPda(assetAddress: Address): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [
      getUtf8Encoder().encode("listing"),
      getAddressEncoder().encode(assetAddress),
    ],
  });
  return address;
}

export async function getBoostsPda(assetAddress: Address): Promise<Address> {
  const [address] = await getProgramDerivedAddress({
    programAddress: PROGRAM_ID,
    seeds: [
      getUtf8Encoder().encode("boosts"),
      getAddressEncoder().encode(assetAddress),
    ],
  });
  return address;
}

// ---- Account fetching ----

export async function fetchCanvasState() {
  const rpc = getRpc();
  const pda = await getCanvasStatePda();
  return fetchMaybeCanvasState(rpc, pda);
}

export async function fetchListing(assetAddress: Address) {
  const rpc = getRpc();
  const pda = await getListingPda(assetAddress);
  return fetchMaybeListing(rpc, pda);
}

export async function fetchBoosts(assetAddress: Address) {
  const rpc = getRpc();
  const pda = await getBoostsPda(assetAddress);
  return fetchMaybeBoosts(rpc, pda);
}

/**
 * Batch-fetch listings and boosts for multiple assets in 2 RPC calls
 * (getMultipleAccounts) instead of 2*N individual calls.
 */
export async function fetchAllListingsAndBoosts(
  assetAddresses: Address[]
): Promise<{
  listings: MaybeAccount<Listing>[];
  boosts: MaybeAccount<Boosts>[];
}> {
  const rpc = getRpc();

  // Derive all PDAs in parallel
  const [listingPdas, boostPdas] = await Promise.all([
    Promise.all(assetAddresses.map((a) => getListingPda(a))),
    Promise.all(assetAddresses.map((a) => getBoostsPda(a))),
  ]);

  // Batch fetch: 2 RPC calls instead of 2*N.
  // Boosts are decoded tolerantly: stale on-chain layouts (from pre-migration
  // program versions) are treated as "not present" instead of crashing the
  // whole region fetch.
  const [listings, rawBoosts] = await Promise.all([
    fetchAllMaybeListing(rpc, listingPdas),
    fetchEncodedAccounts(rpc, boostPdas),
  ]);

  const boosts: MaybeAccount<Boosts>[] = rawBoosts.map((encoded) => {
    if (!encoded.exists) return encoded as MaybeAccount<Boosts>;
    try {
      return decodeBoosts(encoded);
    } catch (err) {
      console.warn(
        `[fetchAllListingsAndBoosts] Skipping boosts account ${encoded.address} with stale layout:`,
        err instanceof Error ? err.message : err
      );
      return { address: encoded.address, exists: false } as MaybeAccount<Boosts>;
    }
  });

  return { listings, boosts };
}

// ---- Bitmap parsing ----

/** Decode the 2592-byte CanvasState bitmap into a Set of "x:y" strings */
export function parseBitmap(bitmap: Uint8Array | ReadonlyUint8Array): Set<string> {
  const occupied = new Set<string>();
  for (let i = 0; i < bitmap.length; i++) {
    const byte = bitmap[i];
    if (byte === 0) continue;
    for (let bit = 0; bit < 8; bit++) {
      if ((byte & (1 << bit)) !== 0) {
        const index = i * 8 + bit;
        const x = index % GRID_WIDTH;
        const y = Math.floor(index / GRID_WIDTH);
        occupied.add(`${x}:${y}`);
      }
    }
  }
  return occupied;
}

// ---- Region attribute extraction from Core assets ----

export interface RegionAttributes {
  x: number;
  y: number;
  width: number;
  height: number;
  imageUri: string;
  link: string;
}

/** Parse key-value attributes from a Metaplex Core asset's Attributes plugin */
export function parseRegionAttributes(
  attributeList: Array<{ key: string; value: string }>
): RegionAttributes {
  const attrs: Record<string, string> = {};
  for (const { key, value } of attributeList) {
    attrs[key] = value;
  }
  return {
    x: parseInt(attrs["x"] || "0", 10),
    y: parseInt(attrs["y"] || "0", 10),
    width: parseInt(attrs["width"] || "1", 10),
    height: parseInt(attrs["height"] || "1", 10),
    imageUri: attrs["image_uri"] || "",
    link: attrs["link"] || "",
  };
}

// ---- Core asset fetching ----

const MPL_CORE_PROGRAM_ID = "CoREENxT6tW1HoK8ypY1SxRMZTcVPm7R94rH4PZNhX7d";

/**
 * Fetch all Metaplex Core assets belonging to our collection.
 * Uses getProgramAccounts with memcmp filters on the Core program.
 *
 * Core AssetV1 layout:
 *  byte 0: key = 1 (AssetV1)
 *  bytes 1-32: owner
 *  byte 33: updateAuthority type = 2 (Collection)
 *  bytes 34-65: updateAuthority address (= collection pubkey)
 */
export async function fetchAllCoreAssets(collectionAddress: string) {
  const rpc = getRpc();

  const accounts = await rpc
    .getProgramAccounts(MPL_CORE_PROGRAM_ID as Address, {
      encoding: "base64",
      filters: [
        // byte 0 = 1 (AssetV1 key discriminator) — base58 "2" (0x01)
        { memcmp: { offset: 0n, bytes: "2", encoding: "base58" } },
        // byte 33 = 2 (UpdateAuthority::Collection) — base58 "3" (0x02)
        { memcmp: { offset: 33n, bytes: "3", encoding: "base58" } },
        // bytes 34-65 = collection address
        { memcmp: { offset: 34n, bytes: collectionAddress, encoding: "base58" } },
      ],
    })
    .send();

  return accounts;
}

// ---- IPFS helper ----

export function ipfsToGateway(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    const cid = uri.slice(7);
    if (config.pinataGateway) {
      return `https://${config.pinataGateway}/ipfs/${cid}`;
    }
    return `https://ipfs.io/ipfs/${cid}`;
  }
  return uri;
}
