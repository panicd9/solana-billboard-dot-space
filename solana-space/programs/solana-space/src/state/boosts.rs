use anchor_lang::prelude::*;

#[account]
pub struct Boosts {
    /// The asset this boost record belongs to
    pub asset: Pubkey,
    /// Bitflags: bit 0 = Highlighted, bit 1 = Glowing, bit 2 = Trending
    pub flags: u8,
    /// Bump seed for this PDA
    pub bump: u8,
}

impl Boosts {
    // 32 (asset) + 1 (flags) + 1 (bump) = 34
    pub const INIT_SPACE: usize = 32 + 1 + 1;

    pub fn has_boost(&self, flag: u8) -> bool {
        self.flags & flag != 0
    }

    pub fn add_boost(&mut self, flag: u8) {
        self.flags |= flag;
    }
}
