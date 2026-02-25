export interface Region {
  id: string;
  startX: number;
  startY: number;
  width: number;
  height: number;
  owner: string;
  imageUrl: string;
  linkUrl: string;
  purchasePrice: number;
  isListed: boolean;
  listingPrice?: number;
  createdAt: number;
  // Premium features
  isHighlighted: boolean;
  highlightExpiresAt?: number;
  hasGlowBorder: boolean;
  glowExpiresAt?: number;
  isTrending: boolean;
  trendingExpiresAt?: number;
}

export const HIGHLIGHT_COST = 0.05;
export const GLOW_COST = 0.08;
export const TRENDING_COST = 0.15;
export const PREMIUM_DURATION = 24 * 60 * 60 * 1000; // 24 hours

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
export const PRICE_PER_BLOCK = 0.01;
