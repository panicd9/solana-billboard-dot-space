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
  boostFlags: number;
  isHighlighted: boolean;
  hasGlowBorder: boolean;
  isTrending: boolean;
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

