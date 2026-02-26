use anchor_lang::prelude::*;
use crate::error::ErrorCode;

#[account]
pub struct Listing {
    /// The seller who created the listing
    pub seller: Pubkey,
    /// The Metaplex Core asset being sold
    pub asset: Pubkey,
    /// Starting price in USDC lamports (6 decimals)
    pub start_price: u64,
    /// Ending price in USDC lamports (6 decimals)
    pub end_price: u64,
    /// Unix timestamp when the price curve starts
    pub start_time: i64,
    /// Unix timestamp when the price curve ends
    pub end_time: i64,
    /// Bump seed for this PDA
    pub bump: u8,
}

impl Listing {
    // 32 + 32 + 8 + 8 + 8 + 8 + 1 = 97
    pub const INIT_SPACE: usize = 32 + 32 + 8 + 8 + 8 + 8 + 1;

    /// Calculate the current price via linear interpolation (integer math only).
    ///
    /// - Before start_time: start_price
    /// - After end_time: end_price
    /// - Between: linear interpolation using u128 intermediaries
    pub fn current_price(&self, now: i64) -> Result<u64> {
        if now <= self.start_time {
            return Ok(self.start_price);
        }
        if now >= self.end_time {
            return Ok(self.end_price);
        }
        if self.start_price == self.end_price {
            return Ok(self.start_price);
        }

        let elapsed = (now - self.start_time) as u128;
        let duration = (self.end_time - self.start_time) as u128;

        if self.end_price > self.start_price {
            // Increasing price: start + (end - start) * elapsed / duration
            let diff = (self.end_price - self.start_price) as u128;
            let delta = diff
                .checked_mul(elapsed)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?
                / duration;
            Ok(self.start_price + delta as u64)
        } else {
            // Decreasing price: start - (start - end) * elapsed / duration
            let diff = (self.start_price - self.end_price) as u128;
            let delta = diff
                .checked_mul(elapsed)
                .ok_or(error!(ErrorCode::ArithmeticOverflow))?
                / duration;
            Ok(self.start_price - delta as u64)
        }
    }
}
