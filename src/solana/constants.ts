import type { Address } from "@solana/kit";
import { config } from "@/config/env";

export const PROGRAM_ID = config.programId as Address;
export const COLLECTION_ADDRESS = config.collectionAddress as Address;
export const TREASURY = config.treasury as Address;

// Must match Rust constants.rs
export const GRID_WIDTH = 192;
export const GRID_HEIGHT = 108;
export const BLOCK_SIZE = 10;
export const TOTAL_BLOCKS = GRID_WIDTH * GRID_HEIGHT;

export const CENTER_ZONE_WIDTH = 60;
export const CENTER_ZONE_HEIGHT = 34;
export const CENTER_ZONE_X = (GRID_WIDTH - CENTER_ZONE_WIDTH) / 2;
export const CENTER_ZONE_Y = (GRID_HEIGHT - CENTER_ZONE_HEIGHT) / 2;

export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const SOL_DECIMALS = 9;

export const CENTER_PRICE_PER_BLOCK = 500_000n;
export const CURVE_START_PRICE = 40_000n;
export const CURVE_END_PRICE = 500_000n;
export const CURVE_TOTAL_BLOCKS = BigInt(
  TOTAL_BLOCKS - CENTER_ZONE_WIDTH * CENTER_ZONE_HEIGHT
);

export const BOOST_HIGHLIGHTED = 1;
export const BOOST_GLOWING = 2;
export const BOOST_TRENDING = 4;

export const BOOST_PRICE = 15_000_000n;

export const MARKETPLACE_FEE_BPS = 400;
