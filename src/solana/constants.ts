import type { Address } from "@solana/kit";
import { config } from "@/config/env";

export const PROGRAM_ID = config.programId as Address;
export const COLLECTION_ADDRESS = config.collectionAddress as Address;
export const TREASURY = config.treasury as Address;

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

// Pricing (in lamports, 9 decimals — SOL @ 1000 USDC)
export const CENTER_PRICE_PER_BLOCK = 120_000n; // 0.00012 SOL
export const CURVE_START_PRICE = 10_000n; // 0.00001 SOL
export const CURVE_END_PRICE = 100_000n; // 0.0001 SOL
export const CURVE_TOTAL_BLOCKS = BigInt(
  TOTAL_BLOCKS - CENTER_ZONE_WIDTH * CENTER_ZONE_HEIGHT
); // 18696

// Boost flags
export const BOOST_HIGHLIGHTED = 1;
export const BOOST_GLOWING = 2;
export const BOOST_TRENDING = 4;

// Boost prices (lamports)
export const BOOST_PRICE_HIGHLIGHTED = 1_000_000n; // 0.001 SOL
export const BOOST_PRICE_GLOWING = 2_000_000n; // 0.002 SOL
export const BOOST_PRICE_TRENDING = 5_000_000n; // 0.005 SOL

// Marketplace fee: 2.5% (250 basis points)
export const MARKETPLACE_FEE_BPS = 250;

export const SOL_DECIMALS = 9;
