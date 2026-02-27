use anchor_lang::prelude::*;
use mpl_core::{
    fetch_asset_plugin,
    instructions::UpdatePluginV1CpiBuilder,
    types::{Attribute, Attributes, Plugin, PluginType},
};
use crate::constants::*;
use crate::error::ErrorCode;
use crate::state::CanvasState;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct UpdateRegionImageArgs {
    pub new_image_uri: String,
}

#[derive(Accounts)]
pub struct UpdateRegionImage<'info> {
    /// The NFT owner
    pub owner: Signer<'info>,

    #[account(
        seeds = [CANVAS_SEED],
        bump,
    )]
    pub canvas_state: AccountLoader<'info, CanvasState>,

    /// The Metaplex Core asset to update
    /// CHECK: Owner field is validated in the handler
    #[account(mut)]
    pub asset: AccountInfo<'info>,

    /// The collection account
    /// CHECK: Validated in handler against canvas_state.collection
    #[account(mut)]
    pub collection: AccountInfo<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,

    /// Payer for potential reallocation if attributes grow
    #[account(mut)]
    pub payer: Signer<'info>,
}

/// Helper to find an attribute value by key from the existing on-chain attributes.
fn find_attr(attrs: &[Attribute], key: &str) -> Result<String> {
    attrs
        .iter()
        .find(|a| a.key == key)
        .map(|a| a.value.clone())
        .ok_or_else(|| error!(ErrorCode::MetaplexCpiFailed))
}

pub fn update_region_image_handler(
    ctx: Context<UpdateRegionImage>,
    args: UpdateRegionImageArgs,
) -> Result<()> {
    // 1. Validate collection and get bump
    let bump = {
        let canvas_state = ctx.accounts.canvas_state.load()?;
        require!(
            ctx.accounts.collection.key() == canvas_state.collection,
            ErrorCode::InvalidCollection
        );
        canvas_state.bump
    };

    // 2. Validate the signer is the NFT owner
    let asset_data = ctx.accounts.asset.try_borrow_data()?;
    require!(asset_data.len() >= 33, ErrorCode::MetaplexCpiFailed);
    let owner_bytes: [u8; 32] =
        asset_data[1..33].try_into().map_err(|_| ErrorCode::MetaplexCpiFailed)?;
    let asset_owner = Pubkey::new_from_array(owner_bytes);
    drop(asset_data);

    require!(asset_owner == ctx.accounts.owner.key(), ErrorCode::UnauthorizedOwner);

    // 3. Validate input
    require!(args.new_image_uri.len() <= MAX_URI_LENGTH, ErrorCode::UriTooLong);

    // 4. Read existing attributes to preserve all other fields
    let (_, existing_attrs, _) =
        fetch_asset_plugin::<Attributes>(&ctx.accounts.asset, PluginType::Attributes)
            .map_err(|_| error!(ErrorCode::MetaplexCpiFailed))?;

    let x = find_attr(&existing_attrs.attribute_list, "x")?;
    let y = find_attr(&existing_attrs.attribute_list, "y")?;
    let width = find_attr(&existing_attrs.attribute_list, "width")?;
    let height = find_attr(&existing_attrs.attribute_list, "height")?;
    let link = find_attr(&existing_attrs.attribute_list, "link")?;

    // 5. Reconstruct attribute list with only image_uri changed
    let attributes = vec![
        Attribute { key: "x".to_string(), value: x },
        Attribute { key: "y".to_string(), value: y },
        Attribute { key: "width".to_string(), value: width },
        Attribute { key: "height".to_string(), value: height },
        Attribute { key: "image_uri".to_string(), value: args.new_image_uri },
        Attribute { key: "link".to_string(), value: link },
    ];

    // 6. Update via CPI
    let signer_seeds: &[&[u8]] = &[CANVAS_SEED, &[bump]];

    UpdatePluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .asset(&ctx.accounts.asset.to_account_info())
        .collection(Some(&ctx.accounts.collection.to_account_info()))
        .payer(&ctx.accounts.payer.to_account_info())
        .authority(Some(&ctx.accounts.canvas_state.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .plugin(Plugin::Attributes(Attributes { attribute_list: attributes }))
        .invoke_signed(&[signer_seeds])?;

    Ok(())
}
