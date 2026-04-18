use anchor_lang::prelude::*;
use mpl_core::instructions::CreateCollectionV2CpiBuilder;
use crate::constants::*;
use crate::state::CanvasState;

#[derive(AnchorDeserialize, AnchorSerialize)]
pub struct InitializeArgs {
    pub treasury: Pubkey,
    pub collection_uri: String,
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + CanvasState::INIT_SPACE,
        seeds = [CANVAS_SEED],
        bump,
    )]
    pub canvas_state: AccountLoader<'info, CanvasState>,

    /// The collection account (fresh keypair, signer)
    /// CHECK: Initialized by Metaplex Core CPI
    #[account(mut)]
    pub collection: Signer<'info>,

    /// CHECK: Metaplex Core program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}

pub fn initialize_handler(ctx: Context<Initialize>, args: InitializeArgs) -> Result<()> {
    let mut canvas_state = ctx.accounts.canvas_state.load_init()?;
    canvas_state.authority = ctx.accounts.authority.key();
    canvas_state.treasury = args.treasury;
    canvas_state.collection = ctx.accounts.collection.key();
    canvas_state.total_minted = 0;
    canvas_state.bump = ctx.bumps.canvas_state;
    let bump = canvas_state.bump;

    drop(canvas_state);

    let signer_seeds: &[&[u8]] = &[CANVAS_SEED, &[bump]];

    CreateCollectionV2CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
        .collection(&ctx.accounts.collection.to_account_info())
        .payer(&ctx.accounts.authority.to_account_info())
        .update_authority(Some(&ctx.accounts.canvas_state.to_account_info()))
        .system_program(&ctx.accounts.system_program.to_account_info())
        .name(COLLECTION_NAME.to_string())
        .uri(args.collection_uri)
        .invoke_signed(&[signer_seeds])?;

    Ok(())
}
