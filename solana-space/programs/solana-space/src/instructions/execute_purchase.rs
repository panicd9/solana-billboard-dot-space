use anchor_lang::prelude::*;
#[cfg(not(feature = "pay-sol"))]
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};
#[cfg(feature = "pay-sol")]
use anchor_lang::system_program;
use mpl_core::instructions::TransferV1CpiBuilder;
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::{CanvasState, Listing};

#[derive(Accounts)]
pub struct ExecutePurchase<'info> {
    #[account(mut)]
    pub buyer: Signer<'info>,

    /// CHECK: The original seller, receives payment and rent from closed listing.
    /// Validated via has_one on listing.
    #[account(mut)]
    pub seller: AccountInfo<'info>,

    #[account(
        seeds = [CANVAS_SEED],
        bump,
    )]
    pub canvas_state: AccountLoader<'info, CanvasState>,

    /// The Metaplex Core asset being purchased
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
        has_one = seller,
        close = seller,
    )]
    pub listing: Account<'info, Listing>,

    // --- USDC payment accounts ---
    #[cfg(not(feature = "pay-sol"))]
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[cfg(not(feature = "pay-sol"))]
    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = buyer,
    )]
    pub buyer_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[cfg(not(feature = "pay-sol"))]
    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub seller_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[cfg(not(feature = "pay-sol"))]
    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub treasury_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[cfg(not(feature = "pay-sol"))]
    pub token_program: Interface<'info, TokenInterface>,

    // --- SOL payment: buyer pays seller + treasury directly ---
    #[cfg(feature = "pay-sol")]
    /// CHECK: Treasury wallet validated in handler against canvas_state.treasury
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn execute_purchase_handler(ctx: Context<ExecutePurchase>) -> Result<()> {
    let listing = &ctx.accounts.listing;

    // 1. Validate collection and payment accounts
    {
        let canvas_state = ctx.accounts.canvas_state.load()?;
        require!(
            ctx.accounts.collection.key() == canvas_state.collection,
            ErrorCode::InvalidCollection
        );
        #[cfg(not(feature = "pay-sol"))]
        require!(
            ctx.accounts.usdc_mint.key() == canvas_state.usdc_mint,
            ErrorCode::InvalidUsdcMint
        );
        #[cfg(feature = "pay-sol")]
        require!(
            ctx.accounts.treasury.key() == canvas_state.treasury,
            ErrorCode::InvalidTreasury
        );
    }

    // 2. Calculate current price via linear interpolation
    let clock = Clock::get()?;
    let price = listing.current_price(clock.unix_timestamp)?;

    // 3. Calculate fee (2.5%) and seller proceeds
    let fee = (price as u128)
        .checked_mul(MARKETPLACE_FEE_BPS as u128)
        .ok_or(error!(ErrorCode::ArithmeticOverflow))?
        / (BPS_DENOMINATOR as u128);
    let fee = fee as u64;
    let seller_amount = price.checked_sub(fee).ok_or(error!(ErrorCode::ArithmeticOverflow))?;

    // 4. Transfer payment from buyer to seller
    #[cfg(not(feature = "pay-sol"))]
    if seller_amount > 0 {
        let transfer_to_seller = TransferChecked {
            from: ctx.accounts.buyer_usdc_ata.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.seller_usdc_ata.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_to_seller);
        token_interface::transfer_checked(cpi_ctx, seller_amount, USDC_DECIMALS)?;
    }
    #[cfg(feature = "pay-sol")]
    if seller_amount > 0 {
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.seller.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_ix);
        system_program::transfer(cpi_ctx, seller_amount)?;
    }

    // 5. Transfer fee from buyer to treasury
    #[cfg(not(feature = "pay-sol"))]
    if fee > 0 {
        let transfer_to_treasury = TransferChecked {
            from: ctx.accounts.buyer_usdc_ata.to_account_info(),
            mint: ctx.accounts.usdc_mint.to_account_info(),
            to: ctx.accounts.treasury_usdc_ata.to_account_info(),
            authority: ctx.accounts.buyer.to_account_info(),
        };
        let cpi_ctx =
            CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_to_treasury);
        token_interface::transfer_checked(cpi_ctx, fee, USDC_DECIMALS)?;
    }
    #[cfg(feature = "pay-sol")]
    if fee > 0 {
        let transfer_ix = system_program::Transfer {
            from: ctx.accounts.buyer.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_ix);
        system_program::transfer(cpi_ctx, fee)?;
    }

    // 6. Transfer NFT from listing PDA (current owner) to buyer
    let asset_key = ctx.accounts.asset.key();
    let listing_seeds: &[&[u8]] = &[LISTING_SEED, asset_key.as_ref(), &[listing.bump]];

    TransferV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(Some(&ctx.accounts.collection.to_account_info()))
        .payer(&ctx.accounts.buyer.to_account_info())
        .authority(Some(&ctx.accounts.listing.to_account_info()))
        .new_owner(&ctx.accounts.buyer.to_account_info())
        .system_program(Some(&ctx.accounts.system_program.to_account_info()))
        .invoke_signed(&[listing_seeds])?;

    // 7. Listing account is closed by `close = seller` constraint

    Ok(())
}
