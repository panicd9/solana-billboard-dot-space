# Solana Billboard

A Solana-powered pixel marketplace where users purchase rectangular grid regions on a shared 1920x1080 canvas, upload images, trade regions via Dutch auctions, and boost visibility — all backed by on-chain NFTs.

## How It Works

The canvas is a 192x108 grid of 10px blocks. Users select a rectangular area, pay with native SOL, and receive a Metaplex Core NFT representing ownership. Owners can upload images, set external links, list regions for sale on the marketplace, or purchase boosts (highlight, glow, trending) to increase visibility.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, shadcn/ui |
| Solana Client | @solana/kit, @solana/react-hooks, @solana/client |
| Smart Contract | Rust, Anchor 0.31, Metaplex Core |
| Payments | Native SOL |
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
VITE_PROGRAM_ID=SBaMPg4GAto7N7LRv7vXKsS4FiNz3R9aCyVSEE2cQPa
VITE_COLLECTION_ADDRESS=                   # From initialize script output
VITE_TREASURY=                             # SOL recipient pubkey
VITE_PINATA_JWT=                           # Your Pinata API key
VITE_PINATA_GATEWAY=                       # Your Pinata gateway domain
```

### 3. Deploy the Program (Devnet)

```bash
# Build the Anchor program
cd solana-space && anchor build && cd ..

# Initialize the program (creates CanvasState + Metaplex Core collection)
TREASURY=<your-treasury-pubkey> npx tsx solana-space/scripts/initialize.ts --devnet
```

The script prints `VITE_COLLECTION_ADDRESS` — add it (and your `VITE_TREASURY`) to your `.env`.

Fund your wallet with devnet SOL via `solana airdrop` or the [Solana Faucet](https://faucet.solana.com/).

### 4. Start Development Server

```bash
npm run dev
```

Open [http://localhost:8080](http://localhost:8080).

### Localnet Setup (Alternative)

For local development with [Surfpool](https://github.com/txtx/surfpool):

```bash
surfpool start
TREASURY=<pubkey> npx tsx solana-space/scripts/initialize.ts          # defaults to localnet
npm run dev
```

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

**Center zone** (60x34 blocks at canvas center): fixed 0.0005 SOL per block.

**Outer zone** (remaining 18,696 blocks): linear bonding curve from 0.00004 to 0.0005 SOL per block, increasing as more blocks are sold.

**Boosts**: Highlighted (0.015 SOL), Glowing Border (0.015 SOL), Trending (0.015 SOL).

**Marketplace fee**: 4% on secondary sales.

Full saturation cost: ~6 SOL.

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

Program ID: `SBaMPg4GAto7N7LRv7vXKsS4FiNz3R9aCyVSEE2cQPa`

## Architecture

**Provider stack**: `QueryClientProvider` > `SolanaProvider` > `TooltipProvider` > `BrowserRouter`

**Data flow**: On-chain Core assets are fetched via `getProgramAccounts`, listing/boost PDAs are batch-fetched with `getMultipleAccounts`, and all state is exposed through `RegionContext`. Mutations use optimistic updates via React Query with background refetches for consistency.

**Canvas rendering**: HTML5 Canvas 2D with support for drag-to-select, pan, zoom, region image rendering, hover tooltips, and boost visual effects (glow borders, highlights).

## License

MIT
