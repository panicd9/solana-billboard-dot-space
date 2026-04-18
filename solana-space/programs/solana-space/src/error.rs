use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Region X coordinate out of bounds")]
    InvalidXCoordinate,

    #[msg("Region Y coordinate out of bounds")]
    InvalidYCoordinate,

    #[msg("Region width must be at least 1")]
    InvalidWidth,

    #[msg("Region height must be at least 1")]
    InvalidHeight,

    #[msg("Region extends beyond grid boundaries")]
    RegionOutOfBounds,

    #[msg("One or more blocks in this region are already occupied")]
    RegionOccupied,

    #[msg("URI exceeds maximum length")]
    UriTooLong,

    #[msg("Link exceeds maximum length")]
    LinkTooLong,

    #[msg("Invalid treasury account")]
    InvalidTreasury,

    #[msg("Arithmetic overflow in price calculation")]
    ArithmeticOverflow,

    #[msg("Only the NFT owner can update the region")]
    UnauthorizedOwner,

    #[msg("Metaplex Core CPI failed")]
    MetaplexCpiFailed,

    #[msg("Invalid collection address")]
    InvalidCollection,

    // --- Boost errors ---
    #[msg("Invalid boost type")]
    InvalidBoostType,

    // --- Marketplace errors ---
    #[msg("Only the NFT owner can create a listing")]
    NotAssetOwner,

    #[msg("Listing start price must be greater than zero")]
    InvalidStartPrice,

    #[msg("Listing end price must be greater than zero")]
    InvalidEndPrice,

    #[msg("Duration must be greater than zero")]
    InvalidDuration,

    #[msg("Only the seller can cancel the listing")]
    UnauthorizedCancel,

    #[msg("NFT is currently listed on the marketplace")]
    AssetIsListed,
}
