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

**Pixel Canvas Studio** is a Solana-integrated pixel marketplace SPA where users purchase rectangular grid regions, upload images to them, and trade them. Built with Vite + React 18 + TypeScript + Tailwind CSS + shadcn/ui.

### Provider Stack (App.tsx)

`QueryClientProvider` → `SolanaProvider` → `TooltipProvider` → `BrowserRouter`

- **SolanaProvider** wraps `@solana/wallet-adapter-react` configured for devnet with Phantom wallet
- **RegionProvider** (mounted in `pages/Index.tsx`, not App) holds all pixel region state

### Core Data Flow

All region state lives in `RegionContext` (`src/context/RegionContext.tsx`):
- `regions: Region[]` — purchased pixel regions
- `occupancy: Map<string, string>` — `"col:row"` → `regionId` for fast collision detection
- `loadedImages: Map<string, HTMLImageElement>` — preloaded images for canvas rendering
- Operations: `purchaseRegion`, `setRegionImage`, `listRegion`, `unlistRegion`, `buyListedRegion`

**Currently all state is client-side with mock addresses. No on-chain program calls yet.**

### Grid System (src/types/region.ts)

192×108 grid of 10px blocks = 1920×1080 canvas. Regions are rectangles defined by `(startX, startY, width, height)` in grid coordinates. Price: 0.01 SOL per block.

### Key Components

| Component | Role |
|-----------|------|
| `PixelCanvas` | Canvas2D renderer — drag-to-select regions, renders region images, hover tooltips |
| `PurchasePanel` | Floating panel for buying selected region + image upload |
| `RegionSidebar` | Details panel for a selected region (edit image/URL, list/unlist, buy) |
| `MarketplaceView` | Grid listing of all regions with sort options |
| `CanvasToolbar` | Header with canvas/marketplace toggle + wallet connect |

### Routing

Single page app: `/` renders `Index`, `*` renders `NotFound`. Views toggle between canvas and marketplace via local state, not routes.

## Conventions

- Import paths use `@/` alias mapping to `./src`
- UI primitives are in `src/components/ui/` (shadcn/ui — do not manually edit these)
- Custom components go directly in `src/components/`
- Dark theme only — CSS variables defined in `src/index.css` with teal primary (#00D2BE) and gold accent (#FFC837)
- Fonts: Space Grotesk (headings), JetBrains Mono (code)
- `global: "globalThis"` is defined in vite.config.ts for Buffer polyfill compatibility
