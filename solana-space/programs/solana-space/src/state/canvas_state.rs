use anchor_lang::prelude::*;
use crate::constants::*;

#[account(zero_copy)]
#[repr(C)]
pub struct CanvasState {
    /// The admin authority that initialized the canvas
    pub authority: Pubkey,
    /// Treasury wallet that receives SOL payments (mint, boost, marketplace fee)
    pub treasury: Pubkey,
    /// Metaplex Core Collection address
    pub collection: Pubkey,
    /// Total regions minted (count of NFTs)
    pub total_minted: u32,
    /// Number of non-center blocks sold (drives bonding curve price)
    pub curve_blocks_sold: u32,
    /// Total blocks consumed across all minted regions (Σ width*height).
    /// Drives milestone events for the giveaway. Invariant: equals popcount(bitmap).
    pub blocks_minted: u32,
    /// Bump seed for this PDA
    pub bump: u8,
    /// Trailing padding: required to absorb implicit tail padding so the struct
    /// is bytemuck::Pod-safe (no uninitialized bytes). Struct alignment = 4 (u32),
    /// so the 1-byte `bump` + 2592-byte `bitmap` tail needs 3 bytes to round up.
    pub _padding: [u8; 3],
    /// Occupancy bitmap: 1 bit per block, 20736 blocks = 2592 bytes
    /// bit index = y * GRID_WIDTH + x
    /// 1 = occupied, 0 = free
    pub bitmap: [u8; BITMAP_SIZE],
}

impl CanvasState {
    // 32 (authority) + 32 (treasury) + 32 (collection)
    // + 4 (total_minted) + 4 (curve_blocks_sold) + 4 (blocks_minted)
    // + 1 (bump) + 3 (padding) + 2592 (bitmap) = 2704
    pub const INIT_SPACE: usize = 32 + 32 + 32 + 4 + 4 + 4 + 1 + 3 + BITMAP_SIZE;

    /// Check if a specific block at (x, y) is occupied
    pub fn is_occupied(&self, x: u16, y: u16) -> bool {
        let index: usize = (y as usize) * (GRID_WIDTH as usize) + (x as usize);
        let byte_index = index / 8;
        let bit_index = index % 8;
        (self.bitmap[byte_index] & (1 << bit_index)) != 0
    }

    /// Mark a specific block at (x, y) as occupied
    pub fn set_occupied(&mut self, x: u16, y: u16) {
        let index = (y as usize) * (GRID_WIDTH as usize) + (x as usize);
        let byte_index = index / 8;
        let bit_index = index % 8;
        self.bitmap[byte_index] |= 1 << bit_index;
    }

    /// Check if an entire rectangular region is free
    pub fn is_region_free(&self, x: u16, y: u16, width: u16, height: u16) -> bool {
        for dy in 0..height {
            for dx in 0..width {
                if self.is_occupied(x + dx, y + dy) {
                    return false;
                }
            }
        }
        true
    }

    /// Mark an entire rectangular region as occupied
    pub fn set_region_occupied(&mut self, x: u16, y: u16, width: u16, height: u16) {
        for dy in 0..height {
            for dx in 0..width {
                self.set_occupied(x + dx, y + dy);
            }
        }
    }
}
