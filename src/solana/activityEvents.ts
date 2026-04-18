import { getBase58Encoder } from "@solana/kit";
import {
  MINT_REGION_DISCRIMINATOR,
  CREATE_LISTING_DISCRIMINATOR,
  CANCEL_LISTING_DISCRIMINATOR,
  EXECUTE_PURCHASE_DISCRIMINATOR,
  BUY_BOOST_DISCRIMINATOR,
  UPDATE_REGION_IMAGE_DISCRIMINATOR,
  UPDATE_REGION_LINK_DISCRIMINATOR,
  UPDATE_REGION_DISCRIMINATOR,
} from "@/generated/instructions";
// Use the Codama-generated program address as source of truth for log parsing.
// The env-derived PROGRAM_ID can drift from the actual deployed program.
import { SOLANA_SPACE_PROGRAM_ADDRESS } from "@/generated/programs";

export type ActivityType =
  | "mint"
  | "list"
  | "cancel"
  | "buy"
  | "boost"
  | "update_image"
  | "update_link"
  | "update_region";

export interface ActivityEvent {
  type: ActivityType;
  signature: string;
  slot: number;
  blockTime: number | null;
  /** Fee payer / invoker — usually the acting user. */
  actor: string;
  /** Core asset address if the instruction targets a specific region. */
  assetAddress: string | null;
  /** For execute_purchase: seller (the previous owner). */
  seller?: string | null;
  /** For buy_boost: the BOOST_* bitflags argument (u8 immediately after discriminator). */
  boostFlags?: number;
}

// Each instruction places the Core asset at a known account index.
// Actor is always the first account (fee payer / owner / buyer).
const INSTRUCTION_META: Record<
  ActivityType,
  { discriminator: Uint8Array; actorIdx: number; assetIdx: number | null; sellerIdx: number | null }
> = {
  mint: { discriminator: MINT_REGION_DISCRIMINATOR, actorIdx: 0, assetIdx: 2, sellerIdx: null },
  list: { discriminator: CREATE_LISTING_DISCRIMINATOR, actorIdx: 0, assetIdx: 2, sellerIdx: null },
  cancel: { discriminator: CANCEL_LISTING_DISCRIMINATOR, actorIdx: 0, assetIdx: 2, sellerIdx: null },
  buy: { discriminator: EXECUTE_PURCHASE_DISCRIMINATOR, actorIdx: 0, assetIdx: 3, sellerIdx: 1 },
  boost: { discriminator: BUY_BOOST_DISCRIMINATOR, actorIdx: 0, assetIdx: 2, sellerIdx: null },
  update_image: { discriminator: UPDATE_REGION_IMAGE_DISCRIMINATOR, actorIdx: 0, assetIdx: 2, sellerIdx: null },
  update_link: { discriminator: UPDATE_REGION_LINK_DISCRIMINATOR, actorIdx: 0, assetIdx: 2, sellerIdx: null },
  update_region: { discriminator: UPDATE_REGION_DISCRIMINATOR, actorIdx: 0, assetIdx: 2, sellerIdx: null },
};

const TYPE_ORDER: ActivityType[] = [
  "mint",
  "list",
  "cancel",
  "buy",
  "boost",
  "update_image",
  "update_link",
  "update_region",
];

const base58 = getBase58Encoder();

function discriminatorMatches(data: Uint8Array, disc: Uint8Array): boolean {
  if (data.length < 8) return false;
  for (let i = 0; i < 8; i++) {
    if (data[i] !== disc[i]) return false;
  }
  return true;
}

function identifyType(data: Uint8Array): ActivityType | null {
  for (const type of TYPE_ORDER) {
    if (discriminatorMatches(data, INSTRUCTION_META[type].discriminator)) return type;
  }
  return null;
}

/** Instruction shape returned from `getTransaction({ encoding: "json" })`. */
interface JsonInstruction {
  programIdIndex: number;
  accounts: readonly number[];
  data: string; // base58
  stackHeight?: number | null;
}

/**
 * Extract program-relevant activity events from a single fetched transaction.
 * Returns 0..N events (a single tx can include multiple of our instructions,
 * e.g. batch mints) — usually 1 for our program.
 */
export function extractEventsFromTransaction(args: {
  signature: string;
  slot: number;
  blockTime: number | null;
  err: unknown;
  accountKeys: readonly string[];
  instructions: readonly JsonInstruction[];
}): ActivityEvent[] {
  const { signature, slot, blockTime, err, accountKeys, instructions } = args;
  if (err !== null) return []; // Skip failed transactions

  const events: ActivityEvent[] = [];
  for (const ix of instructions) {
    const programId = accountKeys[ix.programIdIndex];
    if (programId !== SOLANA_SPACE_PROGRAM_ADDRESS) continue;

    let data: Uint8Array;
    try {
      data = base58.encode(ix.data);
    } catch {
      continue;
    }

    const type = identifyType(data);
    if (!type) continue;

    const meta = INSTRUCTION_META[type];
    const actor = accountKeys[ix.accounts[meta.actorIdx]] ?? "";
    const assetAddress =
      meta.assetIdx != null ? accountKeys[ix.accounts[meta.assetIdx]] ?? null : null;
    const seller =
      meta.sellerIdx != null ? accountKeys[ix.accounts[meta.sellerIdx]] ?? null : null;
    // buy_boost layout: 8-byte discriminator + u8 boost_flags. Extract the u8.
    const boostFlags =
      type === "boost" && data.length >= 9 ? data[8] : undefined;

    events.push({ type, signature, slot, blockTime, actor, assetAddress, seller, boostFlags });
  }
  return events;
}

export const ACTIVITY_FILTER_TYPES: Array<{
  key: "all" | ActivityType;
  label: string;
  matches: (type: ActivityType) => boolean;
}> = [
  { key: "all", label: "All", matches: () => true },
  { key: "mint", label: "Mints", matches: (t) => t === "mint" },
  { key: "buy", label: "Sales", matches: (t) => t === "buy" },
  { key: "list", label: "Listings", matches: (t) => t === "list" || t === "cancel" },
  { key: "boost", label: "Boosts", matches: (t) => t === "boost" },
  {
    key: "update_image",
    label: "Updates",
    matches: (t) => t === "update_image" || t === "update_link" || t === "update_region",
  },
];
