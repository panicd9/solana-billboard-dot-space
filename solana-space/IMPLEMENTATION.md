# Solana Billboard Program Implementation

## Overview

This Anchor program implements a 192x108 grid billboard where users can purchase boxes by paying USDC. Each box stores ownership and IPFS CID information. Pricing is based on distance from the center of the grid.

## Implementation Details

### Architecture

**State Accounts:**
1. `Billboard` PDA - Global configuration (authority, treasury, USDC mint, total minted)
2. `BoxAccount` PDA - Per-box ownership and metadata (coordinates, owner, CID, timestamp)

**Instructions:**
1. `initialize` - Creates the Billboard config PDA
2. `mint_box` - Validates coordinates, calculates price, transfers USDC, creates BoxAccount
3. `update_box` - Allows owner to update their box's CID

### Pricing Model

Uses squared Euclidean distance from center (96, 54):
- Center boxes: 2.0 USDC
- Corner boxes: 0.4 USDC
- Linear interpolation based on `distance_sq` (avoids sqrt, uses integer math)

Formula:
```
price = 0.4 + 1.6 * (MAX_DIST_SQ - distance_sq) / MAX_DIST_SQ
```

### File Structure

```
programs/solana-space/src/
├── constants.rs          # Grid dimensions, pricing constants
├── error.rs              # Custom error codes
├── instructions/
│   ├── initialize.rs     # Billboard initialization
│   ├── mint_box.rs       # Box minting with USDC payment
│   ├── update_box.rs     # Box CID updates
│   └── mod.rs
├── state/
│   ├── billboard.rs      # Billboard config account
│   ├── box_account.rs    # Per-box account
│   └── mod.rs
└── lib.rs                # Program entry point
```

## Current Status

**✅ Implemented:**
- Complete program logic for all 3 instructions
- Grid coordinate validation (192x108)
- Dynamic price calculation based on distance from center
- USDC payment handling via `anchor-spl`
- Owner-only CID updates
- PDA-based box occupancy tracking

**⚠️ Build Issue:**

The program encounters a Rust toolchain compatibility issue during `anchor build`:

```
error: feature `edition2024` is required
  The package requires the Cargo feature called `edition2024`,
  but that feature is not stabilized in this version of Cargo
```

This is caused by newer dependencies in the Solana/Anchor ecosystem requiring Rust edition 2024, which may not be fully supported by the current Solana BPF toolchain.

**Potential Solutions:**
1. Wait for Solana BPF toolchain update to support edition 2024
2. Downgrade to Anchor 0.30.x (may have other compatibility issues)
3. Use nightly Rust toolchain with `-Z` flags (not recommended for production)
4. Lock dependencies to older versions that don't require edition 2024

## Metaplex Core NFT Integration (Future)

The original design included Metaplex Core NFT integration where each box would be represented as a Metaplex Core Asset. However, `mpl-core` crate has version incompatibilities with Anchor 0.31.1:

- `mpl-core 0.9.x` requires `anchor-lang ^0.30`
- `mpl-core 0.11.x` requires Rust edition 2024

**To add NFT support later:**
1. Wait for `mpl-core` compatibility with Anchor 0.31+
2. Add collection creation to `initialize` instruction
3. Add Metaplex Core Asset minting to `mint_box` instruction
4. Add Asset URI updates to `update_box` instruction

The current implementation stores all ownership data in `BoxAccount` PDAs, which provides the core functionality without requiring external NFT standards.

## Testing

Once the build issue is resolved, test with:

```bash
anchor test
```

Create tests for:
- Billboard initialization
- Box minting at various coordinates (center, edge, corner) with price validation
- Duplicate minting prevention (same coordinates)
- Owner-only CID updates
- USDC payment verification

## Dependencies

```toml
[dependencies]
anchor-lang = "0.31.1"
anchor-spl = { version = "0.31.1" }
```

## Program ID

```
DQ1tBHL6cmuUtYAbxvTVvvaNEZtXP1byKeb51gvxWvr2
```

## Next Steps

1. **Resolve build issue** - Update Solana/Anchor toolchain or adjust dependencies
2. **Write tests** - Comprehensive test coverage for all instructions
3. **Add Metaplex integration** - Once dependency compatibility is resolved
4. **Deploy to devnet** - Test in live environment
5. **Frontend integration** - Connect to existing Next.js billboard UI
