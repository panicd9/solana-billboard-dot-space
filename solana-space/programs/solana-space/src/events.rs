use anchor_lang::prelude::*;

#[event]
pub struct BlocksMinted {
    pub blocks_minted: u32,
    pub total_blocks: u32,
    pub bps: u16,
}
