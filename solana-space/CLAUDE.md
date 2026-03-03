# CLAUDE.md — solana-space (Anchor Program)

## Commands

```bash
anchor build                        # Build program (USDC mode) + generate IDL
anchor build -- --features pay-sol  # Build program (SOL mode) + generate IDL
anchor test                         # Build, start localnet, run tests
anchor deploy                       # Deploy to configured cluster
yarn codama                         # Regenerate TS client from IDL (codama.json)
surfpool                            # Start Surfnet local validator
npx tsx scripts/initialize.ts       # Initialize CanvasState + collection
npx tsx scripts/setup-usdc-dev.ts   # Fund wallets with dev USDC (--localnet | --devnet)
```

## Program: `solana_space`

**Program ID:** `E8uWtqn6TESpP5aPzzXYgKf6yhwDJP1ACikKPW6X8Lm6`

Anchor 0.32.1 program that manages a pixel billboard as Metaplex Core NFTs.

### Payment Modes (compile-time feature flag)

| Mode | Build Command | Payment mechanism |
|------|--------------|-------------------|
| **USDC** (default) | `anchor build` | SPL `transfer_checked` via token_interface (USDC mint + ATAs) |
| **SOL** (`pay-sol`) | `anchor build -- --features pay-sol` | `system_program::transfer` (native lamports) |

`#[cfg(feature = "pay-sol")]` gates account structs and transfer logic in `mint_region`, `execute_purchase`, and `buy_boost`. In SOL mode, USDC accounts (mint, ATAs, token_program) are replaced with a single `treasury: AccountInfo` validated against `canvas_state.treasury`.

Pricing values are numerically identical in both modes (SOL @ 1000 USDC: 10^9/10^6 = 1000x cancels with 1/1000 rate).

### State Accounts

| Account | Seeds | Size | Description |
|---------|-------|------|-------------|
| `CanvasState` | `[b"canvas"]` | 2,732 B | Authority, treasury, USDC mint, collection, counters, occupancy bitmap (zero_copy) |
| `Listing` | `[b"listing", asset]` | 97 B | Seller, asset, start/end price + time (linear interpolation) |
| `Boosts` | `[b"boosts", asset]` | 34 B | Asset reference + bitflags for 3 boost types |

### Instructions (9)

| Instruction | Description |
|-------------|-------------|
| `initialize` | Create CanvasState PDA + Metaplex Core collection |
| `mint_region` | Purchase grid region → validate bitmap, calc price, transfer payment, mint Core NFT with Attributes |
| `update_region` | Update image_uri and link on NFT (owner only) |
| `update_region_image` | Update image_uri only |
| `update_region_link` | Update link only |
| `buy_boost` | Purchase highlight/glow/trending boost for NFT |
| `create_listing` | List NFT with start/end price + time, escrow NFT to listing PDA |
| `execute_purchase` | Buy listed NFT — interpolate price, split payment (97.5% seller / 2.5% treasury) |
| `cancel_listing` | Delist and return NFT to seller |

### Pricing Model

- **Center zone** (60×34 blocks): fixed 0.00012 SOL / 0.12 USDC per block
- **Outside center** (18,696 blocks): linear bonding curve 0.00001–0.0001 SOL / 0.01–0.1 USDC per block
- **Boosts**: Highlighted (0.001 SOL / 1 USDC), Glowing (0.002 SOL / 2 USDC), Trending (0.005 SOL / 5 USDC)
- **Marketplace fee**: 2.5% (250 bps)

### Grid Constants (`constants.rs`)

192×108 blocks, 10px per block = 1920×1080 canvas. Occupancy tracked as packed bitmap (1 bit/block, 2,592 bytes).

### Key Dependencies

- `anchor-lang` 0.32.1 (with `init-if-needed`)
- `anchor-spl` 0.32.1 (token_interface for USDC transfers — compiled out in pay-sol mode)
- `mpl-core` 0.11.1 (Metaplex Core CPI — NFT minting + Attributes plugin)

## Generated Client (`clients/js/`)

Codama-generated TypeScript client from `target/idl/solana_space.json`. Uses `@solana/kit` 6.1 as peer dependency. Regenerate after any IDL change with `yarn codama`.

## File Structure

```
solana-space/
├── programs/solana-space/src/
│   ├── lib.rs              # Module declarations + 9 instruction entrypoints
│   ├── constants.rs        # Grid dimensions, pricing, boost costs, fees (cfg-gated for pay-sol)
│   ├── error.rs            # Custom error codes (includes InvalidTreasury for SOL mode)
│   ├── state/              # CanvasState, Listing, Boosts account definitions
│   └── instructions/       # One file per instruction handler (cfg-gated payment logic)
├── clients/js/src/generated/  # Codama output (do not edit manually)
├── scripts/                # initialize.ts, setup-usdc-dev.ts
├── tests/                  # Anchor test suite (ts-mocha)
├── .surfpool/              # Surfnet config + deployment runbooks
├── Anchor.toml             # Cluster config (localnet default)
├── codama.json             # IDL → TS client generation config
└── txtx.yml                # Surfpool project config
```

## Conventions

- Do not manually edit files in `clients/js/src/generated/` — always regenerate with `yarn codama`
- Account state changes must update the occupancy bitmap via `is_occupied()` / `set_occupied()` / `is_region_free()` / `set_region_occupied()` on CanvasState
- Payment amounts: SOL uses 9 decimals (lamports), USDC uses 6 decimals — numerical values are the same
- NFT metadata stored as Metaplex Core Attributes plugin (x, y, width, height, image_uri, link)
- Tests use `@coral-xyz/anchor` with localnet cluster; validator clones Metaplex Core program on startup
