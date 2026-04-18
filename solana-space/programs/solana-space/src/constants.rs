use anchor_lang::prelude::*;

#[constant]
pub const CANVAS_SEED: &[u8] = b"canvas";

// Grid dimensions (each block = 10x10 pixels on a 1920x1080 canvas)
pub const GRID_WIDTH: u16 = 192;
pub const GRID_HEIGHT: u16 = 108;
pub const TOTAL_BLOCKS: usize = (GRID_WIDTH as usize) * (GRID_HEIGHT as usize); // 20,736

// Bitmap size: ceil(20736 / 8) = 2592 bytes
pub const BITMAP_SIZE: usize = (TOTAL_BLOCKS + 7) / 8;

// Center zone: 60x34 blocks with fixed pricing
pub const CENTER_ZONE_WIDTH: u16 = 60;
pub const CENTER_ZONE_HEIGHT: u16 = 34;
pub const CENTER_ZONE_X: u16 = (GRID_WIDTH - CENTER_ZONE_WIDTH) / 2; // 66
pub const CENTER_ZONE_Y: u16 = (GRID_HEIGHT - CENTER_ZONE_HEIGHT) / 2; // 37
pub const CENTER_ZONE_BLOCKS: u64 =
    (CENTER_ZONE_WIDTH as u64) * (CENTER_ZONE_HEIGHT as u64); // 2040

pub const CENTER_PRICE_PER_BLOCK: u64 = 400_000;

pub const CURVE_START_PRICE: u64 = 40_000;
pub const CURVE_END_PRICE: u64 = 400_000;

// Total blocks on the bonding curve (everything outside center zone)
pub const CURVE_TOTAL_BLOCKS: u64 =
    (TOTAL_BLOCKS as u64) - CENTER_ZONE_BLOCKS; // 18696

// Maximum URI/link length
pub const MAX_URI_LENGTH: usize = 200;
pub const MAX_LINK_LENGTH: usize = 200;

// Collection metadata
pub const COLLECTION_NAME: &str = "Solana Billboard";

// === Boost constants ===
#[constant]
pub const BOOSTS_SEED: &[u8] = b"boosts";

pub const BOOST_HIGHLIGHTED: u8 = 1 << 0; // bit 0 = 1
pub const BOOST_GLOWING: u8 = 1 << 1; // bit 1 = 2
pub const BOOST_TRENDING: u8 = 1 << 2; // bit 2 = 4

pub const BOOST_PRICE: u64 = 15_000_000;

// === Marketplace constants ===
#[constant]
pub const LISTING_SEED: &[u8] = b"listing";

// Treasury fee: 4% = 400 basis points
pub const MARKETPLACE_FEE_BPS: u64 = 400;
pub const BPS_DENOMINATOR: u64 = 10_000;
