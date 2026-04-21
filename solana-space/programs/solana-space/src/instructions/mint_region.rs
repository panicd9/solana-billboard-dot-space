use anchor_lang::prelude::*;
use anchor_lang::system_program::{self, Transfer};
use mpl_core::{
    instructions::CreateV2CpiBuilder,
    types::{Attribute, Attributes, Plugin, PluginAuthority, PluginAuthorityPair},
};
use crate::constants::*;
use crate::error::ErrorCode;
use crate::events::BlocksMinted;
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

    /// SOL recipient for the mint payment.
    /// CHECK: Validated in handler against canvas_state.treasury.
    #[account(mut)]
    pub treasury: AccountInfo<'info>,

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

/// Calculate total price (in SOL lamports) for a rectangular region using:
/// - Fixed price for center zone blocks
/// - Linear bonding curve for all other blocks
fn calculate_region_price(
    x: u16,
    y: u16,
    width: u16,
    height: u16,
    curve_blocks_sold: u32,
) -> Result<u64> {
    let (center_count, curve_count) = count_center_and_curve_blocks(x, y, width, height);

    let center_total = (center_count as u128)
        .checked_mul(CENTER_PRICE_PER_BLOCK as u128)
        .ok_or(ErrorCode::ArithmeticOverflow)?;

    let curve_total = if curve_count == 0 {
        0u128
    } else {
        let k = curve_count as u128;
        let s = curve_blocks_sold as u128;
        let start = CURVE_START_PRICE as u128;
        let end = CURVE_END_PRICE as u128;
        let divisor = (CURVE_TOTAL_BLOCKS - 1) as u128;

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
    let end_x = args.x.checked_add(args.width).ok_or(ErrorCode::RegionOutOfBounds)?;
    let end_y = args.y.checked_add(args.height).ok_or(ErrorCode::RegionOutOfBounds)?;
    require!(
        end_x <= GRID_WIDTH && end_y <= GRID_HEIGHT,
        ErrorCode::RegionOutOfBounds
    );
    require!(args.image_uri.len() <= MAX_URI_LENGTH, ErrorCode::UriTooLong);
    require!(args.link.len() <= MAX_LINK_LENGTH, ErrorCode::LinkTooLong);

    // 2. Validate collection + treasury, check bitmap, read curve supply
    let curve_blocks_sold = {
        let canvas_state = ctx.accounts.canvas_state.load()?;
        require!(
            ctx.accounts.collection.key() == canvas_state.collection,
            ErrorCode::InvalidCollection
        );
        require!(
            ctx.accounts.treasury.key() == canvas_state.treasury,
            ErrorCode::InvalidTreasury
        );
        require!(
            canvas_state.is_region_free(args.x, args.y, args.width, args.height),
            ErrorCode::RegionOccupied
        );
        canvas_state.curve_blocks_sold
    };

    // 3. Calculate total price
    let total_price =
        calculate_region_price(args.x, args.y, args.width, args.height, curve_blocks_sold)?;

    // 4. Transfer SOL from payer to treasury
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.to_account_info(),
        Transfer {
            from: ctx.accounts.payer.to_account_info(),
            to: ctx.accounts.treasury.to_account_info(),
        },
    );
    system_program::transfer(cpi_ctx, total_price)?;

    // 5. Mark bitmap as occupied and update counters
    let added_blocks = (args.width as u32)
        .checked_mul(args.height as u32)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    let (bump, blocks_minted_total) = {
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
        canvas_state.blocks_minted = canvas_state
            .blocks_minted
            .checked_add(added_blocks)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        (canvas_state.bump, canvas_state.blocks_minted)
    };

    let bps = ((blocks_minted_total as u64) * 10_000 / TOTAL_BLOCKS as u64) as u16;
    emit!(BlocksMinted {
        blocks_minted: blocks_minted_total,
        total_blocks: TOTAL_BLOCKS as u32,
        bps,
    });

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
