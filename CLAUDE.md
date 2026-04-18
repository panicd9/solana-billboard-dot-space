# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run test         # Run tests once (vitest run)
npm run test:watch   # Watch mode (vitest)
```

## Architecture

**Solana Billboard** (solanabillboard.space) is a Solana-integrated pixel marketplace where users mint rectangular grid regions as NFTs, attach images/links, boost them, and resell via Dutch-auction listings. Built with Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui.

### Provider Stack ([src/App.tsx](src/App.tsx))

`QueryClientProvider` → `SolanaProvider` → `TooltipProvider` → `BrowserRouter` → `RegionProvider` → `Routes`

- **SolanaProvider** ([src/components/SolanaProvider.tsx](src/components/SolanaProvider.tsx)) uses the new `@solana/kit` stack — `createClient` from `@solana/client` + `SolanaProvider` from `@solana/react-hooks` with `autoDiscover()` wallet connectors and `autoConnect: true` persistence. No `wallet-adapter-react`.
- **RegionProvider** ([src/context/RegionContext.tsx](src/context/RegionContext.tsx)) is mounted inside `BrowserRouter` in App.tsx so all routes share region state.

### On-chain Integration

This app talks to a deployed Anchor/Solana program (program ID in [src/config/env.ts](src/config/env.ts), default `DQ1tBHL6cmuUtYAbxvTVvvaNEZtXP1byKeb51gvxWvr2`). Network, RPC/WS URLs, collection address, treasury wallet, and Pinata credentials are all `VITE_*` env vars with devnet defaults. **All payments are in native SOL — no SPL token flows.**

- [src/solana/constants.ts](src/solana/constants.ts) — program addresses, grid dims, pricing constants, boost flags (must match Rust `constants.rs`).
- [src/solana/pricing.ts](src/solana/pricing.ts) — `calculateRegionPrice` mirrors the on-chain pricing function; `calculateListingCurrentPrice` computes the current Dutch-auction price.
- [src/solana/accounts.ts](src/solana/accounts.ts) — account fetching + `ipfsToGateway` URL helper.
- [src/solana/transactions.ts](src/solana/transactions.ts) — instruction builders.
- [src/solana/activityEvents.ts](src/solana/activityEvents.ts) — parses program logs into activity feed events.
- [src/solana/ipfs.ts](src/solana/ipfs.ts) — Pinata upload.

### Core Data Flow

All region state is read from on-chain accounts via TanStack Query and exposed through `RegionContext`:

- **Queries**: `useCanvasState` (global canvas account — occupancy bitmap, curve blocks sold), `useOnChainRegions` (all region accounts), `useActivityEvents` (program activity feed), `useProgramTransactions` (recent signatures).
- **Mutations** (in [src/hooks/useProgramTransactions.ts](src/hooks/useProgramTransactions.ts)): `useMintRegion`, `useUpdateRegionImage`, `useUpdateRegionLink`, `useCreateListing`, `useCancelListing`, `useExecutePurchase`, `useBuyBoost`. Each applies optimistic cache updates.
- **Image preload**: Context preloads static images into `loadedImages: Map<id, HTMLImageElement>`. Animated GIFs are decoded via `gifuct-js` in [src/hooks/useAnimatedImages.ts](src/hooks/useAnimatedImages.ts) and exposed as `animatedImages`.
- `occupancy` is a `Set<string>` of `"x:y"` keys derived from the canvas bitmap; `getRegionAt` falls back to scanning connected occupied blocks when a click hits a bitmap cell whose full `Region` object isn't loaded yet.

### Grid & Pricing ([src/solana/constants.ts](src/solana/constants.ts), [src/types/region.ts](src/types/region.ts))

- 192×108 grid of 10px blocks = 1920×1080 canvas (20,736 blocks total).
- **Center zone**: 60×34 block region centered at (66, 37). Flat price **0.0004 SOL/block** (0.816 SOL for the full zone).
- **Curve zone**: remaining 18,696 blocks follow a linear bonding curve from **0.00004 → 0.0004 SOL/block** as `curveBlocksSold` increases (~4.11 SOL fully saturated).
- Full billboard saturates at ~4.93 SOL. Prices are in SOL lamports (9 decimals). Use `formatSol()` for display.
- **Boosts**: HIGHLIGHTED, GLOWING, TRENDING — flat **0.015 SOL** each, each stored as a Unix-second `i64` purchase time on the `Boosts` PDA. Active iff `now - at < 86_400` (24h window). Re-buying while active shifts the timestamp forward by one duration (stackable extend). Purchase flags are bitflags (a single tx can activate/extend multiple at once). See [src/lib/boosts.ts](src/lib/boosts.ts) for the shared `BOOST_META` table driving all boost UI.
- **Marketplace fee**: 4% (400 bps), paid in SOL to the treasury wallet.

### Routes ([src/App.tsx](src/App.tsx))

| Path | Page |
|------|------|
| `/` | [Index](src/pages/Index.tsx) — canvas + marketplace toggle |
| `/u/:wallet` | [Profile](src/pages/Profile.tsx) — public owner profile |
| `/embed/r/:assetId` | [Embed](src/pages/Embed.tsx) — iframe widget for a single region |
| `/activity` | [Activity](src/pages/Activity.tsx) — program activity feed |
| `*` | [NotFound](src/pages/NotFound.tsx) |

Deep link: `/?region=<assetId>` on `/` auto-selects and opens a region once data loads.

### Key Components ([src/components/](src/components/))

| Component | Role |
|-----------|------|
| `PixelCanvas` | Canvas2D renderer — drag-to-select, renders images + animated GIFs, hover tooltips, pricing overlay |
| `CanvasToolbar` | Header with canvas/marketplace toggle + `WalletButton` + `WalletBalances` |
| `PurchasePanel` | Floating panel for minting selected region (image upload → Pinata, link, price preview) |
| `RegionSidebar` | Details for a selected region — edit image/URL, list/unlist, buy, buy boosts, copy-embed |
| `MarketplaceView` | Sortable grid listing |
| `TrendingSidebar` | Collapsible list of trending-boosted regions |
| `RegionMiniMap` | Overview map used in sidebars |
| `ActivityRow` | Single event row used in `/activity` |
| `NavLink` | Router link with active state |

UI primitives in [src/components/ui/](src/components/ui/) are shadcn/ui — do not hand-edit.

## Conventions

- Import paths use `@/` alias mapping to `./src`.
- Custom components go directly in [src/components/](src/components/); shadcn primitives stay under `ui/`.
- Dark theme only — CSS variables in [src/index.css](src/index.css), teal primary (#00D2BE) and gold accent (#FFC837).
- Fonts: Space Grotesk (headings), JetBrains Mono (code).
- `global: "globalThis"` is defined in [vite.config.ts](vite.config.ts) for Buffer polyfill compatibility.
- Grid dimensions and pricing constants must stay in sync with the Rust program's `constants.rs`.
- Treat lamport amounts as `bigint` end-to-end; only convert to `number` at the display boundary via `formatSol`.
