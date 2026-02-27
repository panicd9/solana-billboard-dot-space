# Solana Billboard

A Solana-powered pixel marketplace where users purchase rectangular grid regions on a shared 1920x1080 canvas, upload images, trade regions via Dutch auctions, and boost visibility — all backed by on-chain NFTs.

## How It Works

The canvas is a 192x108 grid of 10px blocks. Users select a rectangular area, pay with USDC, and receive a Metaplex Core NFT representing ownership. Owners can upload images, set external links, list regions for sale on the marketplace, or purchase boosts (highlight, glow, trending) to increase visibility.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Solana Client | @solana/kit, @solana/react-hooks, @solana/client |
| Smart Contract | Rust, Anchor 0.31, Metaplex Core |
| Payments | USDC (SPL Token) |
| Storage | IPFS via Pinata |
| Testing | Vitest |

## Project Structure

```
pixel-canvas-studio/
├── src/
│   ├── components/        # React components (PixelCanvas, MarketplaceView, etc.)
│   ├── context/           # RegionContext — central state management
│   ├── hooks/             # useOnChainRegions, useProgramTransactions, useCanvasState
│   ├── solana/            # RPC helpers, PDA derivation, pricing, transactions
│   ├── config/            # Environment configuration
│   └── types/             # TypeScript types
├── solana-space/
│   ├── programs/solana-space/src/   # Anchor program (Rust)
│   ├── clients/js/src/generated/    # Codama-generated TypeScript client
│   └── scripts/                     # Setup & initialization scripts
└── .env.example           # Required environment variables
```

## Getting Started

### Prerequisites

- Node.js 18+
- Rust & Cargo
- Solana CLI
- Anchor CLI 0.31+
- A Phantom wallet (or any Solana wallet)

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
VITE_SOLANA_NETWORK=devnet
VITE_RPC_URL=                              # Optional, defaults based on network
VITE_PROGRAM_ID=DQ1tBHL6cmuUtYAbxvTVvvaNEZtXP1byKeb51gvxWvr2
VITE_USDC_MINT=Gh9ZwEmdLJ8DscKNTkTqPbNwLNNBjuSzaG9Vp2KGtKJr
VITE_COLLECTION_ADDRESS=                   # From setup script output
VITE_TREASURY_USDC_ATA=                    # From setup script output
VITE_PINATA_JWT=                           # Your Pinata API key
VITE_PINATA_GATEWAY=                       # Your Pinata gateway domain
```

### 3. Deploy the Program (Devnet)

```bash
# Build the Anchor program
cd solana-space && anchor build && cd ..

# Run the devnet setup (airdrops SOL, creates treasury ATA, initializes program)
npx tsx solana-space/scripts/setup-usdc-dev.ts --devnet
```

The script outputs `VITE_COLLECTION_ADDRESS` and `VITE_TREASURY_USDC_ATA` — add them to your `.env`.

Fund your wallet with devnet USDC via the [Circle Faucet](https://faucet.circle.com/).

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

### Localnet Setup (Alternative)

For local development with [Surfpool](https://github.com/txtx/surfpool):

```bash
surfpool start
npx tsx solana-space/scripts/setup-usdc-dev.ts          # defaults to localnet
npm run dev
```

The localnet setup clones the USDC-dev mint from devnet and funds wallets automatically.

## Commands

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run test         # Run tests (vitest run)
npm run test:watch   # Watch mode (vitest)
```

## Pricing Model

**Center zone** (60x34 blocks at canvas center): fixed 0.12 USDC per block.

**Outer zone** (remaining 18,696 blocks): linear bonding curve from 0.01 to 0.10 USDC per block, increasing as more blocks are sold.

**Boosts**: Highlighted (1 USDC), Glowing Border (2 USDC), Trending (5 USDC).

**Marketplace fee**: 2.5% on secondary sales.

## On-Chain Program

The Anchor program (`solana-space`) manages all state on-chain:

| Instruction | Description |
|-------------|-------------|
| `initialize` | Create CanvasState PDA and Metaplex Core collection |
| `mint_region` | Purchase blocks and mint region as Core NFT |
| `update_region_image` | Update the IPFS image URI |
| `update_region_link` | Update the external link |
| `create_listing` | List region for sale (Dutch auction) |
| `cancel_listing` | Remove a marketplace listing |
| `execute_purchase` | Buy a listed region |
| `buy_boost` | Activate highlight, glow, or trending boosts |

Program ID: `DQ1tBHL6cmuUtYAbxvTVvvaNEZtXP1byKeb51gvxWvr2`

## Architecture

**Provider stack**: `QueryClientProvider` > `SolanaProvider` > `TooltipProvider` > `BrowserRouter`

**Data flow**: On-chain Core assets are fetched via `getProgramAccounts`, listing/boost PDAs are batch-fetched with `getMultipleAccounts`, and all state is exposed through `RegionContext`. Mutations use optimistic updates via React Query with background refetches for consistency.

**Canvas rendering**: HTML5 Canvas 2D with support for drag-to-select, pan, zoom, region image rendering, hover tooltips, and boost visual effects (glow borders, highlights).

## License

MIT
