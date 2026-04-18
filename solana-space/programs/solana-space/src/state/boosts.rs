use anchor_lang::prelude::*;

use crate::constants::BOOST_DURATION_SECONDS;

#[account]
pub struct Boosts {
    /// The asset this boost record belongs to
    pub asset: Pubkey,
    /// Bump seed for this PDA
    pub bump: u8,
    /// Unix seconds marking the start of the currently-valid Highlight window.
    /// 0 = never purchased.
    /// Active iff `now - highlighted_at < BOOST_DURATION_SECONDS`.
    /// On re-buy while still active, this is advanced by one `BOOST_DURATION_SECONDS`
    /// so the live window extends forward rather than resetting — users never lose paid time.
    pub highlighted_at: i64,
    /// See `highlighted_at`.
    pub glowing_at: i64,
    /// See `highlighted_at`.
    pub trending_at: i64,
}

impl Boosts {
    // 32 (asset) + 1 (bump) + 8*3 (timestamps) = 57
    pub const INIT_SPACE: usize = 32 + 1 + 8 + 8 + 8;

    pub fn is_active(at: i64, now: i64) -> bool {
        at > 0 && now - at < BOOST_DURATION_SECONDS
    }

    /// Shift `current` forward by one duration if still active, otherwise reset to `now`.
    /// This is the "extend vs fresh" policy for re-buying a boost.
    pub fn extend(current: i64, now: i64) -> i64 {
        if Self::is_active(current, now) {
            current + BOOST_DURATION_SECONDS
        } else {
            now
        }
    }
}
