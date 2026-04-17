import type { Address } from "@solana/kit";
import { config } from "@/config/env";

export const PROGRAM_ID = config.programId as Address;
export const USDC_MINT = config.usdcMint as Address;
export const COLLECTION_ADDRESS = config.collectionAddress as Address;
export const TREASURY_USDC_ATA = config.treasuryUsdcAta as Address;

// Grid dimensions (must match Rust constants.rs)
export const GRID_WIDTH = 192;
export const GRID_HEIGHT = 108;
export const BLOCK_SIZE = 10;
export const TOTAL_BLOCKS = GRID_WIDTH * GRID_HEIGHT; // 20736

// Center zone
export const CENTER_ZONE_WIDTH = 60;
export const CENTER_ZONE_HEIGHT = 34;
export const CENTER_ZONE_X = (GRID_WIDTH - CENTER_ZONE_WIDTH) / 2; // 66
export const CENTER_ZONE_Y = (GRID_HEIGHT - CENTER_ZONE_HEIGHT) / 2; // 37

// Pricing (in USDC lamports, 6 decimals)
export const CENTER_PRICE_PER_BLOCK = 120_000n; // 0.12 USDC
export const CURVE_START_PRICE = 10_000n; // 0.01 USDC
export const CURVE_END_PRICE = 100_000n; // 0.10 USDC
export const CURVE_TOTAL_BLOCKS = BigInt(
  TOTAL_BLOCKS - CENTER_ZONE_WIDTH * CENTER_ZONE_HEIGHT
); // 18696

// Boost flags
export const BOOST_HIGHLIGHTED = 1;
export const BOOST_GLOWING = 2;
export const BOOST_TRENDING = 4;

// Boost prices (USDC lamports)
export const BOOST_PRICE_HIGHLIGHTED = 1_000_000n; // 1 USDC
export const BOOST_PRICE_GLOWING = 2_000_000n; // 2 USDC
export const BOOST_PRICE_TRENDING = 5_000_000n; // 5 USDC

// Marketplace fee: 4% (400 basis points)
export const MARKETPLACE_FEE_BPS = 400;

export const USDC_DECIMALS = 6;
