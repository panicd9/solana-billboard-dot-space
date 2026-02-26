use anchor_lang::prelude::*;
use anchor_spl::token_interface::{
    self, Mint, TokenAccount, TokenInterface, TransferChecked,
};
use mpl_core::{
    instructions::CreateV2CpiBuilder,
    types::{Attribute, Attributes, Plugin, PluginAuthority, PluginAuthorityPair},
};
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::CanvasState;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct MintRegionArgs {
    pub x: u16,
    pub y: u16,
    pub width: u16,
    pub height: u16,
    pub image_uri: String,
    pub link: String,
}

#[derive(Accounts)]
pub struct MintRegion<'info> {
    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [CANVAS_SEED],
        bump,
    )]
    pub canvas_state: AccountLoader<'info, CanvasState>,

    /// The new Core asset account (fresh keypair, signer)
    /// CHECK: Initialized by Metaplex Core CPI
    #[account(mut)]
    pub asset: Signer<'info>,

    /// The Metaplex Core collection
    /// CHECK: Validated in handler against canvas_state.collection
    #[account(mut)]
    pub collection: AccountInfo<'info>,

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

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

/// Check if a block is inside the fixed-price center zone.
fn is_center_zone(x: u16, y: u16) -> bool {
    x >= CENTER_ZONE_X
        && x < CENTER_ZONE_X + CENTER_ZONE_WIDTH
        && y >= CENTER_ZONE_Y
        && y < CENTER_ZONE_Y + CENTER_ZONE_HEIGHT
}

/// Count how many blocks in a region fall inside vs outside the center zone.
fn count_center_and_curve_blocks(x: u16, y: u16, width: u16, height: u16) -> (u64, u64) {
    let mut center_count: u64 = 0;
    let mut curve_count: u64 = 0;
    for dy in 0..height {
        for dx in 0..width {
            if is_center_zone(x + dx, y + dy) {
                center_count += 1;
            } else {
                curve_count += 1;
            }
        }
    }
    (center_count, curve_count)
}

/// Calculate total price for a rectangular region using:
/// - Fixed price for center zone blocks
/// - Linear bonding curve for all other blocks
///
/// Bonding curve: price(n) = START + (END - START) * n / (TOTAL - 1)
/// where n = the nth non-center block sold (0-indexed).
///
/// For k new curve blocks starting at supply s, the sum is:
///   k * START + (END - START) * (k * s + k * (k - 1) / 2) / (TOTAL - 1)
fn calculate_region_price(
    x: u16,
    y: u16,
    width: u16,
    height: u16,
    curve_blocks_sold: u32,
) -> Result<u64> {
    let (center_count, curve_count) = count_center_and_curve_blocks(x, y, width, height);

    // Center zone: fixed price
    let center_total = (center_count as u128)
        .checked_mul(CENTER_PRICE_PER_BLOCK as u128)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    // Bonding curve: sum of arithmetic sequence
    let curve_total = if curve_count == 0 {
        0u128
    } else {
        let k = curve_count as u128;
        let s = curve_blocks_sold as u128;
        let start = CURVE_START_PRICE as u128;
        let end = CURVE_END_PRICE as u128;
        let divisor = (CURVE_TOTAL_BLOCKS - 1) as u128; // 18695

        // Sum = k * start + (end - start) * (k * s + k * (k - 1) / 2) / divisor
        let base = k.checked_mul(start).ok_or(ErrorCode::ArithmeticOverflow)?;
        let seq_sum = k
            .checked_mul(s)
            .and_then(|ks| {
                k.checked_mul(k.saturating_sub(1))
                    .map(|kk1| kk1 / 2)
                    .and_then(|half| ks.checked_add(half))
            })
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        let curve_part = (end - start)
            .checked_mul(seq_sum)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            / divisor;
        base.checked_add(curve_part)
            .ok_or(ErrorCode::ArithmeticOverflow)?
    };

    let total = center_total
        .checked_add(curve_total)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    Ok(total as u64)
}

pub fn mint_region_handler(ctx: Context<MintRegion>, args: MintRegionArgs) -> Result<()> {
    // 1. Validate bounds
    require!(args.width >= 1, ErrorCode::InvalidWidth);
    require!(args.height >= 1, ErrorCode::InvalidHeight);
    require!(args.x < GRID_WIDTH, ErrorCode::InvalidXCoordinate);
    require!(args.y < GRID_HEIGHT, ErrorCode::InvalidYCoordinate);
    require!(
        args.x + args.width <= GRID_WIDTH && args.y + args.height <= GRID_HEIGHT,
        ErrorCode::RegionOutOfBounds
    );
    require!(args.image_uri.len() <= MAX_URI_LENGTH, ErrorCode::UriTooLong);
    require!(args.link.len() <= MAX_LINK_LENGTH, ErrorCode::LinkTooLong);

    // 2. Validate collection and usdc_mint, check bitmap, read current curve supply
    let curve_blocks_sold = {
        let canvas_state = ctx.accounts.canvas_state.load()?;
        require!(
            ctx.accounts.collection.key() == canvas_state.collection,
            ErrorCode::InvalidCollection
        );
        require!(
            ctx.accounts.usdc_mint.key() == canvas_state.usdc_mint,
            ErrorCode::InvalidUsdcMint
        );
        require!(
            canvas_state.is_region_free(args.x, args.y, args.width, args.height),
            ErrorCode::RegionOccupied
        );
        canvas_state.curve_blocks_sold
    };

    // 3. Calculate total price (center = fixed, outside = bonding curve)
    let total_price =
        calculate_region_price(args.x, args.y, args.width, args.height, curve_blocks_sold)?;

    // 4. Transfer USDC from payer to treasury
    let transfer_accounts = TransferChecked {
        from: ctx.accounts.payer_usdc_ata.to_account_info(),
        mint: ctx.accounts.usdc_mint.to_account_info(),
        to: ctx.accounts.treasury_usdc_ata.to_account_info(),
        authority: ctx.accounts.payer.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.token_program.to_account_info(), transfer_accounts);
    token_interface::transfer_checked(cpi_ctx, total_price, USDC_DECIMALS)?;

    // 5. Mark bitmap as occupied and update counters
    let bump = {
        let mut canvas_state = ctx.accounts.canvas_state.load_mut()?;
        canvas_state.set_region_occupied(args.x, args.y, args.width, args.height);
        canvas_state.total_minted =
            canvas_state.total_minted.checked_add(1).ok_or(ErrorCode::ArithmeticOverflow)?;
        let (_, curve_count) =
            count_center_and_curve_blocks(args.x, args.y, args.width, args.height);
        canvas_state.curve_blocks_sold = canvas_state
            .curve_blocks_sold
            .checked_add(curve_count as u32)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        canvas_state.bump
    };

    // 6. Mint Metaplex Core NFT with Attributes plugin via CPI
    let signer_seeds: &[&[u8]] = &[CANVAS_SEED, &[bump]];

    let asset_name = format!("Billboard Region ({},{} {}x{})", args.x, args.y, args.width, args.height);

    let attributes = vec![
        Attribute { key: "x".to_string(), value: args.x.to_string() },
        Attribute { key: "y".to_string(), value: args.y.to_string() },
        Attribute { key: "width".to_string(), value: args.width.to_string() },
        Attribute { key: "height".to_string(), value: args.height.to_string() },
        Attribute { key: "image_uri".to_string(), value: args.image_uri },
        Attribute { key: "link".to_string(), value: args.link },
    ];

    let plugins = vec![PluginAuthorityPair {
        plugin: Plugin::Attributes(Attributes { attribute_list: attributes }),
        authority: Some(PluginAuthority::UpdateAuthority),
    }];

    CreateV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(Some(&ctx.accounts.collection.to_account_info()))
        .authority(Some(&ctx.accounts.canvas_state.to_account_info()))
        .payer(&ctx.accounts.payer.to_account_info())
        .owner(Some(&ctx.accounts.payer.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(asset_name)
        .uri(String::new())
        .plugins(plugins)
        .invoke_signed(&[signer_seeds])?;

    Ok(())
}
