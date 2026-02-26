use anchor_lang::prelude::*;
use anchor_spl::token_interface::{self, Mint, TokenAccount, TokenInterface, TransferChecked};
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

    // --- USDC payment accounts ---
    pub usdc_mint: InterfaceAccount<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = usdc_mint,
        associated_token::authority = payer,
    )]
    pub payer_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    #[account(
        mut,
        token::mint = usdc_mint,
    )]
    pub treasury_usdc_ata: InterfaceAccount<'info, TokenAccount>,

    pub token_program: Interface<'info, TokenInterface>,
    pub system_program: Program<'info, System>,
}

const ALL_BOOSTS: u8 = BOOST_HIGHLIGHTED | BOOST_GLOWING | BOOST_TRENDING;

/// Sum the USDC cost for each set bit in the flags bitmask.
fn total_boost_price(flags: u8) -> u64 {
    let mut total: u64 = 0;
    if flags & BOOST_HIGHLIGHTED != 0 {
        total += BOOST_PRICE_HIGHLIGHTED;
    }
    if flags & BOOST_GLOWING != 0 {
        total += BOOST_PRICE_GLOWING;
    }
    if flags & BOOST_TRENDING != 0 {
        total += BOOST_PRICE_TRENDING;
    }
    total
}

pub fn buy_boost_handler(ctx: Context<BuyBoost>, args: BuyBoostArgs) -> Result<()> {
    let flags = args.boost_flags;

    // 1. Validate at least one valid boost is requested and no unknown bits are set
    require!(flags != 0 && flags & !ALL_BOOSTS == 0, ErrorCode::InvalidBoostType);

    // 2. Validate collection and USDC mint
    {
        let canvas_state = ctx.accounts.canvas_state.load()?;
        require!(
            ctx.accounts.collection.key() == canvas_state.collection,
            ErrorCode::InvalidCollection
        );
        require!(
            ctx.accounts.usdc_mint.key() == canvas_state.usdc_mint,
            ErrorCode::InvalidUsdcMint
        );
    }

    // 3. Validate asset belongs to collection by reading raw bytes.
    //    Metaplex Core BaseAssetV1 layout:
    //      byte 0:       Key enum discriminant
    //      bytes 1..33:  owner (Pubkey)
    //      byte 33:      UpdateAuthority enum discriminant (0=None, 1=Address, 2=Collection)
    //      bytes 34..66: authority pubkey (collection address when discriminant is 2)
    {
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

    // 4. Check none of the requested boosts are already active
    let boosts = &mut ctx.accounts.boosts;
    require!(boosts.flags & flags == 0, ErrorCode::BoostAlreadyActive);

    // 5. Initialize fields if this is a fresh account (init_if_needed)
    if boosts.asset == Pubkey::default() {
        boosts.asset = ctx.accounts.asset.key();
        boosts.bump = ctx.bumps.boosts;
        boosts.flags = 0;
    }

    // 6. Calculate total price and transfer USDC from payer to treasury
    let price = total_boost_price(flags);
    let transfer_accounts = TransferChecked {
        from: ctx.accounts.payer_usdc_ata.to_account_info(),
        mint: ctx.accounts.usdc_mint.to_account_info(),
        to: ctx.accounts.treasury_usdc_ata.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts);
    token_interface::transfer_checked(cpi_ctx, price, USDC_DECIMALS)?;

    // 7. Set all requested boost flags at once
    boosts.flags |= flags;

    Ok(())
}
