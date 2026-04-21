use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{Boosts, CanvasState};

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct BuyBoostArgs {
    /// Bitmask of boosts to buy: 1 = Highlighted, 2 = Glowing, 4 = Trending.
    /// Can combine flags (e.g. 3 = Highlighted + Glowing, 7 = all three).
    pub boost_flags: u8,
}

#[derive(Accounts)]
pub struct BuyBoost<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        seeds = [CANVAS_SEED],
        bump,
    )]
    pub canvas_state: AccountLoader<'info, CanvasState>,

    /// The Metaplex Core asset to boost
    /// CHECK: Collection membership validated in handler by reading raw bytes
    pub asset: AccountInfo<'info>,

    /// The collection account
    /// CHECK: Validated in handler against canvas_state.collection
    pub collection: AccountInfo<'info>,

    #[account(
        init_if_needed,
        payer = payer,
        space = 8 + Boosts::INIT_SPACE,
        seeds = [BOOSTS_SEED, asset.key().as_ref()],
        bump,
    )]
    pub boosts: Account<'info, Boosts>,

    /// SOL recipient for the boost payment.
    /// CHECK: Validated in handler against canvas_state.treasury.
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

const ALL_BOOSTS: u8 = BOOST_HIGHLIGHTED | BOOST_GLOWING | BOOST_TRENDING;

fn total_boost_price(flags: u8) -> u64 {
    let mut total: u64 = 0;
    if flags & BOOST_HIGHLIGHTED != 0 {
        total += BOOST_HIGHLIGHTED_PRICE;
    }
    if flags & BOOST_GLOWING != 0 {
        total += BOOST_GLOWING_PRICE;
    }
    if flags & BOOST_TRENDING != 0 {
        total += BOOST_TRENDING_PRICE;
    }
    total
}

pub fn buy_boost_handler(ctx: Context<BuyBoost>, args: BuyBoostArgs) -> Result<()> {
    let flags = args.boost_flags;

    // 1. Validate at least one valid boost is requested and no unknown bits are set
    require!(flags != 0 && flags & !ALL_BOOSTS == 0, ErrorCode::InvalidBoostType);

    // 2. Validate collection + treasury
    {
        let canvas_state = ctx.accounts.canvas_state.load()?;
        require!(
            ctx.accounts.collection.key() == canvas_state.collection,
            ErrorCode::InvalidCollection
        );
        require!(
            ctx.accounts.treasury.key() == canvas_state.treasury,
            ErrorCode::InvalidTreasury
        );
    }

    // 3. Validate asset belongs to collection by reading raw bytes.
    //    Metaplex Core BaseAssetV1 layout:
    //      byte 0:       Key enum discriminant
    //      bytes 1..33:  owner (Pubkey)
    //      byte 33:      UpdateAuthority enum discriminant (0=None, 1=Address, 2=Collection)
    //      bytes 34..66: authority pubkey (collection address when discriminant is 2)
    {
        require!(ctx.accounts.asset.owner == &mpl_core::ID, ErrorCode::InvalidAsset);
        let asset_data = ctx.accounts.asset.try_borrow_data()?;
        require!(asset_data.len() >= 66, ErrorCode::MetaplexCpiFailed);
        require!(asset_data[33] == 2, ErrorCode::InvalidCollection);
        let collection_bytes: [u8; 32] =
            asset_data[34..66].try_into().map_err(|_| ErrorCode::MetaplexCpiFailed)?;
        let asset_collection = Pubkey::new_from_array(collection_bytes);
        require!(
            asset_collection == ctx.accounts.collection.key(),
            ErrorCode::InvalidCollection
        );
    }

    // 4. Calculate total price and transfer SOL from payer to treasury
    let price = total_boost_price(flags);
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, price)?;

    // 5. Initialize fields if this is a fresh account (init_if_needed)
    let boosts = &mut ctx.accounts.boosts;
    if boosts.asset == Pubkey::default() {
        boosts.asset = ctx.accounts.asset.key();
        boosts.bump = ctx.bumps.boosts;
    }

    // 6. Advance each requested boost's window (extend if active, fresh 24h if expired)
    let now = Clock::get()?.unix_timestamp;
    if flags & BOOST_HIGHLIGHTED != 0 {
        boosts.highlighted_at = Boosts::extend(boosts.highlighted_at, now);
    }
    if flags & BOOST_GLOWING != 0 {
        boosts.glowing_at = Boosts::extend(boosts.glowing_at, now);
    }
    if flags & BOOST_TRENDING != 0 {
        boosts.trending_at = Boosts::extend(boosts.trending_at, now);
    }

    Ok(())
}
