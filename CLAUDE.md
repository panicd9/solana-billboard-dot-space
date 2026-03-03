# CLAUDE.md

Guidance for Claude Code when working in this monorepo.

## Project Overview

**Solana Billboard** (solanabillboard.space) — a Solana pixel marketplace where users purchase rectangular grid regions as Metaplex Core NFTs, upload images, and trade them. 192×108 grid of 10px blocks = 1920×1080 canvas.

## Repository Structure

```
solana-billboard/
├── src/                  # React frontend (Vite + React 18 + TypeScript + Tailwind + shadcn/ui)
├── solana-space/         # Anchor program + generated TS client
│   ├── programs/         # Rust on-chain program
│   ├── clients/js/       # Codama-generated TypeScript client
│   ├── scripts/          # Deploy & setup scripts
│   └── tests/            # Anchor tests
└── CLAUDE.md             # This file
```

Each subdirectory has its own CLAUDE.md with detailed guidance:
- **Frontend**: see conventions, commands, and architecture in this root (below)
- **On-chain program**: see `solana-space/CLAUDE.md`

## Frontend Commands

```bash
npm run dev          # Start dev server (port 8080)
npm run build        # Production build
npm run build:dev    # Development build
npm run lint         # ESLint
npm run test         # Run tests once (vitest run)
npm run test:watch   # Watch mode (vitest)
```

## Solana Program Commands

```bash
cd solana-space
anchor build                        # Build program (USDC mode)
anchor build -- --features pay-sol  # Build program (SOL mode, for devnet)
anchor test                         # Build + test (localnet)
yarn codama                         # Regenerate TS client from IDL
surfpool                            # Start local validator (Surfnet)
npx tsx scripts/initialize.ts       # Initialize canvas on-chain
npx tsx scripts/setup-usdc-dev.ts   # Fund wallets with dev USDC (USDC mode only)
```

## Payment Modes

The program supports two compile-time payment modes via Cargo feature flags:

- **USDC mode** (default): `anchor build` — payments via SPL token transfers (USDC mint + ATAs)
- **SOL mode**: `anchor build -- --features pay-sol` — payments via native SOL transfers (system program)

SOL pricing assumes SOL ≈ 1000 USDC (numerical lamport values are identical to USDC micro-units).

After switching modes, regenerate the TS client (`yarn codama`) and set `.env` vars:
- SOL mode: `VITE_TREASURY` (wallet pubkey)
- USDC mode: `VITE_TREASURY_USDC_ATA` (token account)

## Conventions (All Code)

- Import paths use `@/` alias → `./src` and `@/generated/` → `./solana-space/clients/js/src/generated`
- Solana client code uses `@solana/kit` (v6) — NOT legacy `@solana/web3.js`
- Program interactions go through Codama-generated client in `solana-space/clients/js/`
