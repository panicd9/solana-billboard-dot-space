use anchor_lang::prelude::*;
use mpl_core::instructions::TransferV1CpiBuilder;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{CanvasState, Listing};

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct CreateListingArgs {
    pub start_price: u64,
    pub end_price: u64,
    pub duration_seconds: u64,
}

#[derive(Accounts)]
pub struct CreateListing<'info> {
    #[account(mut)]
    pub seller: Signer<'info>,

    #[account(
        seeds = [CANVAS_SEED],
        bump,
    )]
    pub canvas_state: AccountLoader<'info, CanvasState>,

    /// The Metaplex Core asset being listed
    /// CHECK: Owner validated in handler by reading raw bytes
    #[account(mut)]
    pub asset: AccountInfo<'info>,

    /// The collection account
    /// CHECK: Validated in handler against canvas_state.collection
    #[account(mut)]
    pub collection: AccountInfo<'info>,

    #[account(
        init,
        payer = seller,
        space = 8 + Listing::INIT_SPACE,
        seeds = [LISTING_SEED, asset.key().as_ref()],
        bump,
    )]
    pub listing: Account<'info, Listing>,

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn create_listing_handler(ctx: Context<CreateListing>, args: CreateListingArgs) -> Result<()> {
    // 1. Validate inputs
    require!(args.start_price > 0, ErrorCode::InvalidStartPrice);
    require!(args.end_price > 0, ErrorCode::InvalidEndPrice);
    require!(
        args.duration_seconds > 0 && args.duration_seconds <= i64::MAX as u64,
        ErrorCode::InvalidDuration
    );

    // 2. Validate collection
    {
        let canvas_state = ctx.accounts.canvas_state.load()?;
        require!(
            ctx.accounts.collection.key() == canvas_state.collection,
            ErrorCode::InvalidCollection
        );
    }

    // 3. Validate seller ownership AND canvas-collection membership by reading raw bytes.
    //    Metaplex Core BaseAssetV1 layout:
    //      byte 0:       Key enum discriminant
    //      bytes 1..33:  owner (Pubkey)
    //      byte 33:      UpdateAuthority enum discriminant (0=None, 1=Address, 2=Collection)
    //      bytes 34..66: authority pubkey (collection address when discriminant is 2)
    {
        let asset_data = ctx.accounts.asset.try_borrow_data()?;
        require!(asset_data.len() >= 66, ErrorCode::MetaplexCpiFailed);
        let owner_bytes: [u8; 32] =
            asset_data[1..33].try_into().map_err(|_| ErrorCode::MetaplexCpiFailed)?;
        let asset_owner = Pubkey::new_from_array(owner_bytes);
        require!(asset_owner == ctx.accounts.seller.key(), ErrorCode::NotAssetOwner);

        require!(asset_data[33] == 2, ErrorCode::InvalidCollection);
        let collection_bytes: [u8; 32] =
            asset_data[34..66].try_into().map_err(|_| ErrorCode::MetaplexCpiFailed)?;
        let asset_collection = Pubkey::new_from_array(collection_bytes);
        require!(
            asset_collection == ctx.accounts.collection.key(),
            ErrorCode::InvalidCollection
        );
    }

    // 4. Calculate timestamps
    let clock = Clock::get()?;
    let start_time = clock.unix_timestamp;
    let end_time = start_time
        .checked_add(args.duration_seconds as i64)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    // 5. Initialize listing PDA
    let listing = &mut ctx.accounts.listing;
    listing.seller = ctx.accounts.seller.key();
    listing.asset = ctx.accounts.asset.key();
    listing.start_price = args.start_price;
    listing.end_price = args.end_price;
    listing.start_time = start_time;
    listing.end_time = end_time;
    listing.bump = ctx.bumps.listing;

    // 6. Escrow: Transfer NFT from seller to listing PDA
    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(Some(&ctx.accounts.collection.to_account_info()))
        .payer(&ctx.accounts.seller.to_account_info())
        .authority(Some(&ctx.accounts.seller.to_account_info()))
        .new_owner(&ctx.accounts.listing.to_account_info())
        .system_program(Some(&ctx.accounts.system_program.to_account_info()))
        .invoke()?;

    Ok(())
}
