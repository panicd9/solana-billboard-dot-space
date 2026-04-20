# Launch Plan: Solana Billboard Mainnet

**PM Owner**: Darko | **Launch Tier**: 1 (Major) | **Target Date**: T+14 days from mainnet program deploy

---

## 1. Positioning & Narrative

**One-sentence pitch**: *Solana Billboard is the Million Dollar Homepage, rebuilt on Solana — own a piece of internet history as an NFT, point it anywhere, and flip it on a Dutch auction.*

**Why now (3 bullets)**:
- Solana has the lowest-cost mint stack on the market (MPL Core + sub-cent fees) — MDH-style economics are finally viable on-chain without gas eating the thesis.
- Attention is the only scarce asset left in crypto. A 1920×1080 fixed canvas is the purest possible attention market — supply is hard-capped at 20,736 blocks, forever.
- NFT fatigue has killed PFP launches but created appetite for *useful* NFTs. A region that links to your project, your X profile, or your memecoin is utility-first by default.

**The angle**: **Nostalgia + fair-launch primitive**, not "NFT play."

The NFT framing is dead on arrival in 2026. The winning narrative is *"Million Dollar Homepage, but the pixels are tradeable and the curve is fair."* This works because:
- **Universally legible** — every crypto-native over 25 remembers MDH; every one under 25 will Google it and get the joke immediately.
- **Memetic** — the canvas itself is the marketing. Every screenshot is a billboard for the billboard.
- **Fair-launch credibility** — the bonding curve (0.00004 → 0.0005 SOL) means early buyers get genuinely better prices, no insider allocation, no team bag. This matters enormously to Solana Twitter post-2024.

**What we are NOT**: not a memecoin, not a PFP project, not a "Web3 advertising platform." Those framings invite the wrong audience and the wrong scrutiny.

---

## 2. Launch Sequence

### Pre-Launch (T-14 to T-1)

- **T-14**: Teaser tweet — single image of empty grid, caption *"20,736 pixels. One canvas. Forever."* Link to landing page with email + wallet capture.
- **T-10**: Publish a 600-word blog post / long-form X thread: *"Why we rebuilt the Million Dollar Homepage on Solana"*. Lead with the story, not the tech.
- **T-7**: Open a Telegram + Discord. Seed with 20-30 friends. Post daily build screenshots.
- **T-7 to T-2**: DM 30 hand-picked Solana projects, KOLs, and memecoin communities offering **free pre-mint of one 10×10 region** in exchange for committing to use it on launch day. This is the single highest-leverage pre-launch action — it solves the cold-start "empty canvas looks dead" problem.
- **T-3**: Devnet open beta — let the waitlist mint freely on devnet to stress-test the flow and seed embed-widget adoption.
- **T-1**: Final teaser — grid populated with placeholder logos of confirmed launch-day partners. *"Tomorrow, mainnet."*

### Launch Day (T-0)

- **00:00 UTC**: Mainnet program flip + canvas seed transaction. Pre-committed partners mint first (coordinated 30-min window) so the canvas isn't empty when public sees it.
- **+1h**: Public mint opens. Launch tweet from founder account with embedded canvas screenshot showing partner logos already populated.
- **+2h**: Coordinate retweet wave from partners — each partner posts *"We're on @solanabillboard — claim yours: [link]"* with their region embed.
- **+4h**: Reddit drop on r/solana. Founder story + screenshot + link.
- **+8h**: Founder AMA in Telegram + spaces with 1-2 confirmed Solana KOLs.
- **End of day**: Status thread — blocks sold, wallets, top 5 regions.

### First 72 Hours

- Daily *"State of the Canvas"* tweet with screenshot + stats.
- Highlight the most creative regions (memes, animated GIFs, project logos) in a daily showcase thread.
- Push embed widgets aggressively — every region owner should see *"Embed this on your site"* as the dominant CTA in `RegionSidebar`.
- Monitor for sniping/bot behavior in center zone; be ready to publicly address it.

### First 2 Weeks

- Week 1: One feature story per day in the *"Region Spotlight"* format.
- Week 1: First Dutch-auction resale becomes a story — tweet it, frame as *"the secondary market is live."*
- Week 2: Boost revenue retro thread — *"Here's what 2 weeks of HIGHLIGHTED/GLOWING/TRENDING tells us about how attention gets priced."*
- Week 2: Open call for an **"Artist Region"** — commission someone to do a coordinated 200-block art piece. Generates a content moment beyond financial speculation.

---

## 2a. Incentive Stack (2.0 SOL Prize Pool)

Four tiered prizes that double as marketing moments. Treasury pre-funds **2.1 SOL** (2.0 + buffer) in a visible wallet — screenshot balance in every milestone tweet.

| Trigger | Prize | Mechanic |
|---------|-------|----------|
| 25% canvas minted | 0.2 SOL | Twitter draw |
| 50% canvas minted | 0.3 SOL | Twitter draw |
| 90% canvas minted | 0.5 SOL | Twitter draw |
| Final block minted | 1 SOL | **Hard-coded in smart contract**, auto-paid via `PrizeVault` PDA |

**Prize shape**: strictly increasing. Every milestone is a bigger reward than the last — the message carried in every tweet is *"keep filling, it gets bigger."* Final-block prize is 2x the 90% tier and 5x the 25% tier, framing the on-chain mechanic as the grand prize.

**Twitter draw rules**: follow profile + retweet + comment region address. Eligibility requires a minted region of at least **10×10 blocks**. Winner selection uses a verifiable public method (twitterpicker.com or published seed+script) announced *before* the draw, not after.

**Effective marketing spend**: 13% at 25% saturation → 33% at full. Prize pool scales with success — each payout only fires if the milestone is hit.

**Engineering dependency (blocking for mainnet)**: Program needs a new `PrizeVault` PDA funded with 1 SOL at deploy. `mint_region` must check `canvas.occupancy.count() == TOTAL_BLOCKS` on success and CPI-transfer vault → minter. Needs tests for race conditions on the final block, one-time-payout invariant, and event emission for UI. Factor into T-14 timeline or push launch.

**Legal**: Add a TOS clause with a free-entry alternative (*"no purchase necessary — free entry by X"*) to keep the US sweepstakes framing legal.

---

## 2b. Partner Cold-Start (Revised: 20, not 30)

Target **20 warm partners**, not 30. Fewer + committed > more + flaky.

Sources, in priority:
1. **Superteam country DAOs** (DE/UK/NG/VN/etc.) — post in Telegrams with specific offer
2. **Solana Foundation grant recipients** — public list, all legit projects needing marketing
3. **Memecoin community managers** (not founders — mods are reachable and mobilize holders)
4. **Founder's own X follows** — 20 warm DMs > 200 cold ones
5. **Podcast/Spaces hosts** (Lightspeed, etc.) — free region in exchange for a mention

---

## 3. Target Audiences (Ranked)

| Rank | Segment | First N | Where | Hook |
|------|---------|--------|-------|------|
| 1 | **Solana memecoin communities** (BONK, WIF, popcat holders) | First 100 | X, TG groups | "Plant your community's flag on the canvas" |
| 2 | **Solana project teams** (mid-tier protocols) | First 100 | X DMs, Superteam | "Permanent on-chain billboard for your protocol" |
| 3 | **NFT collectors / flippers** | First 1,000 | Magic Eden Discord, Tensor | "Bonding curve + Dutch auction = trade the pixels" |
| 4 | **Solana KOLs / influencers** | First 1,000 | X | Free seed regions for the loudest voices |
| 5 | **MDH nostalgia crowd** (older crypto, HN, indie hackers) | Long tail | HN, Indie Hackers, X | The story angle — Show HN post in week 2 |

**First 100 buyers will overwhelmingly be memecoin community members and project teams pre-arranged in the partner outreach.** Don't pretend the first 100 will be organic — they won't be, and that's fine.

---

## 4. Success Metrics

The TAM is ~6.07 SOL per saturation, so **revenue is not the headline metric**. Attention, wallets, and embeds are.

| Window | Metric | Floor (acceptable) | Target | Stretch |
|--------|--------|---------------------|--------|---------|
| **48h** | Blocks sold | 8% (~1,650) | 15% (~3,100) | 25% (~5,200) |
| **48h** | Unique minting wallets | 80 | 200 | 500 |
| **48h** | Launch tweet impressions | 100K | 500K | 1.5M |
| **48h** | Embed widgets live on external sites | 10 | 30 | 75 |
| **2 weeks** | Blocks sold | 25% | 45% | 65% |
| **2 weeks** | Unique wallets | 300 | 700 | 1,500 |
| **2 weeks** | Boost revenue (SOL) | 1 SOL | 4 SOL | 10 SOL |
| **2 weeks** | Secondary listings created | 20 | 75 | 200 |
| **30 days** | Blocks sold | 50% | 75% | 95%+ |
| **30 days** | Secondary volume / primary volume | 0.3x | 0.8x | 1.5x |
| **30 days** | DAU on canvas | 200 | 800 | 2,000 |

**The single number to optimize for**: **embed widgets live on external sites at 14 days**. Every embed is a permanent acquisition channel — it's the closest thing this product has to a viral loop.

---

## 5. Risks & Mitigations

1. **Bot sniping the center zone in the first 60 seconds** → Center zone is highest-value real estate. *Mitigation*: Reserve 30% of center zone for pre-committed partners minted in a coordinated T-0 window. Publicly disclose. Honest framing beats stealth.
2. **Empty canvas looks dead** (cold-start problem) → *Mitigation*: 25-30 pre-committed partner mints in first hour. Non-negotiable. This is the launch's biggest single risk.
3. **NSFW / illegal content uploaded to a region** → Hosted images are on Pinata, your treasury hosts the canonical view. *Mitigation*: Ship a moderation flag + takedown flow before launch. Publish a one-page content policy. Have a kill-switch that hides image but preserves NFT — never censor the on-chain asset, only the rendered image on solanabillboard.space.
4. **Slow secondary market makes Dutch auctions feel broken** → *Mitigation*: Founder seeds 3-5 listings in week 1 at honest prices to demonstrate the mechanic. Document the first organic resale as a story moment.
5. **Regulatory / IP concerns from logo uploads** → Brand owners may complain about unauthorized logo use. *Mitigation*: DMCA-style takedown form on the site, 24h response SLA, terms of service that puts liability on the uploader. Legal review of TOS pre-launch — this is the one place to spend the legal budget.

---

## 6. Handoff Briefs

### Twitter Engager
- **Voice**: Dry, confident, slightly nostalgic. Reference MDH explicitly and often. Avoid NFT jargon.
- **Cadence**: 2-3 posts/day during launch week, 1/day after. Reply-guy heavily on Solana KOLs who mention attention/canvas/MDH.
- **Hero content**: Daily *State of the Canvas* screenshot thread. Region spotlights. First-resale story.
- **Key messages**: Hard supply cap. Fair bonding curve. Permanent on-chain. Embed anywhere.
- **Don't**: Talk about "Web3 advertising," chase memecoin trends, engagement-bait.

### Growth Hacker
- **Primary lever**: Embed widget distribution. Build an embed gallery page. DM every Solana project that mints a region offering to feature their embed.
- **Secondary lever**: Partnership pre-mints. Aim for 30 confirmed partners by T-1.
- **Channels**: Superteam DAOs, Solana Foundation grant recipients, mid-tier memecoin TGs.
- **Funnel to instrument**: Landing page → wallet connect → first mint. Target 8%+ conversion from connected wallet to mint.
- **Don't**: Run paid ads in launch week. Earned > paid for the MDH narrative.

### Reddit Community Builder
- **Primary subs**: r/solana (T-0 +4h), r/CryptoCurrency (T+3 days, story angle), r/InternetIsBeautiful (T+7, MDH angle).
- **Format**: Founder story post, not a launch announcement. Lead with *"I rebuilt the Million Dollar Homepage on Solana — here's what I learned."*
- **Engagement**: Founder must reply to every top-20 comment in first 6h. No mod-team replies.
- **Don't**: Cross-post aggressively, use referral links, mention price/investment upside (instant ban risk).
