export interface ListingInfo {
  seller: string;
  startPrice: bigint;
  endPrice: bigint;
  startTime: bigint;
  endTime: bigint;
}

export interface Region {
  id: string; // asset address (base58)
  startX: number;
  startY: number;
  width: number;
  height: number;
  owner: string;
  imageUrl: string; // IPFS gateway URL for display
  imageUri: string; // on-chain URI (ipfs://...)
  linkUrl: string;
  purchasePrice: number; // SOL (display value)
  isListed: boolean;
  listing: ListingInfo | null;
  createdAt: number;
  // Unix seconds at which each boost window was last started (or shifted forward on extend).
  // 0 = never purchased. Active iff `nowSec - at < BOOST_DURATION_SECONDS`.
  highlightedAt: bigint;
  glowingAt: bigint;
  trendingAt: bigint;
}

// While a region is listed, the on-chain asset is escrowed to the listing PDA,
// so `r.owner` becomes that PDA address rather than the real seller. Use this
// helper whenever you want to display or filter by the wallet that actually
// controls the region.
export function effectiveOwner(r: Region): string {
  return r.isListed && r.listing ? r.listing.seller : r.owner;
}

export interface Selection {
  col: number;
  row: number;
  width: number;
  height: number;
}

export const GRID_COLS = 192;
export const GRID_ROWS = 108;
export const BLOCK_SIZE = 10;
export const CANVAS_W = GRID_COLS * BLOCK_SIZE;
export const CANVAS_H = GRID_ROWS * BLOCK_SIZE;

// Boost economics — must match Rust constants.rs.
export const BOOST_DURATION_SECONDS = 86_400;

export function isBoostActive(at: bigint, nowSec: number): boolean {
  if (at === 0n) return false;
  return nowSec - Number(at) < BOOST_DURATION_SECONDS;
}

export function boostSecondsRemaining(at: bigint, nowSec: number): number {
  if (at === 0n) return 0;
  return Math.max(0, Number(at) + BOOST_DURATION_SECONDS - nowSec);
}

export function formatBoostCountdown(remainingSec: number): string {
  if (remainingSec <= 0) return "expired";
  const h = Math.floor(remainingSec / 3600);
  const m = Math.floor((remainingSec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return `${remainingSec}s left`;
}
