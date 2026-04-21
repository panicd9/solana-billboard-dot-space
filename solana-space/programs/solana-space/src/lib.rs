pub mod constants;
pub mod error;
pub mod events;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use events::*;
pub use instructions::*;
pub use state::*;

declare_id!("E8uWtqn6TESpP5aPzzXYgKf6yhwDJP1ACikKPW6X8Lm6");

#[program]
pub mod solana_space {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
        instructions::initialize::initialize_handler(ctx, args)
    }

    pub fn mint_region(ctx: Context<MintRegion>, args: MintRegionArgs) -> Result<()> {
        instructions::mint_region::mint_region_handler(ctx, args)
    }

    pub fn update_region(ctx: Context<UpdateRegion>, args: UpdateRegionArgs) -> Result<()> {
        instructions::update_region::update_region_handler(ctx, args)
    }

    pub fn buy_boost(ctx: Context<BuyBoost>, args: BuyBoostArgs) -> Result<()> {
        instructions::buy_boost::buy_boost_handler(ctx, args)
    }

    pub fn create_listing(ctx: Context<CreateListing>, args: CreateListingArgs) -> Result<()> {
        instructions::create_listing::create_listing_handler(ctx, args)
    }

    pub fn execute_purchase(
        ctx: Context<ExecutePurchase>,
        args: ExecutePurchaseArgs,
    ) -> Result<()> {
        instructions::execute_purchase::execute_purchase_handler(ctx, args)
    }

    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        instructions::cancel_listing::cancel_listing_handler(ctx)
    }

    pub fn update_region_image(
        ctx: Context<UpdateRegionImage>,
        args: UpdateRegionImageArgs,
    ) -> Result<()> {
        instructions::update_region_image::update_region_image_handler(ctx, args)
    }

    pub fn update_region_link(
        ctx: Context<UpdateRegionLink>,
        args: UpdateRegionLinkArgs,
    ) -> Result<()> {
        instructions::update_region_link::update_region_link_handler(ctx, args)
    }
}
