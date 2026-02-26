use anchor_lang::prelude::*;
use mpl_core::instructions::TransferV1CpiBuilder;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{CanvasState, Listing};

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [CANVAS_SEED],
        bump,
    )]
    pub canvas_state: AccountLoader<'info, CanvasState>,

    /// The Metaplex Core asset
    /// CHECK: Validated by has_one on listing
    #[account(mut)]
    pub asset: AccountInfo<'info>,

    /// The collection account
    /// CHECK: Validated in handler against canvas_state.collection
    #[account(mut)]
    pub collection: AccountInfo<'info>,

    #[account(
        mut,
        seeds = [LISTING_SEED, asset.key().as_ref()],
        bump = listing.bump,
        has_one = asset,
        has_one = seller @ ErrorCode::UnauthorizedCancel,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn cancel_listing_handler(ctx: Context<CancelListing>) -> Result<()> {
    // 1. Validate collection
    {
        let canvas_state = ctx.accounts.canvas_state.load()?;
        require!(
            ctx.accounts.collection.key() == canvas_state.collection,
            ErrorCode::InvalidCollection
        );
    }

    // 2. Transfer NFT from listing PDA back to seller
    let asset_key = ctx.accounts.asset.key();
    let listing_seeds: &[&[u8]] = &[LISTING_SEED, asset_key.as_ref(), &[ctx.accounts.listing.bump]];

    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(Some(&ctx.accounts.collection.to_account_info()))
        .payer(&ctx.accounts.seller.to_account_info())
        .authority(Some(&ctx.accounts.listing.to_account_info()))
        .new_owner(&ctx.accounts.seller.to_account_info())
        .system_program(Some(&ctx.accounts.system_program.to_account_info()))
        .invoke_signed(&[listing_seeds])?;

    // 3. Listing account is closed by `close = seller` constraint

    Ok(())
}
