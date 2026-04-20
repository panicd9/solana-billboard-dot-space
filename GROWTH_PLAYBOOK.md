# Growth Playbook: Solana Billboard Mainnet

**Owner**: Growth | **Companion to**: [LAUNCH_PLAN.md](./LAUNCH_PLAN.md) | **Date**: 2026-04-19
**North-star number**: **Shares-per-minter ≥ 0.55 within 7d of mint at T+14d.** I.e. of every 100 wallets that mint, at least 55 trigger a share-button tweet within their first week. Concretely at T+14d with the planned ~400 mints: **≥220 share-button tweets fired**.
**Operating principle**: Every minted region is a distribution node or it is wasted. The share button is what turns a mint into a broadcast; everything else (embeds, timelapses, draws) is leverage on top of that primitive.

---

## 1. Embed Widget as Long-Tail Acquisition Channel

The embed at `/embed/r/:assetId` is **not** the primary loop. A region owner already has the source image — wrapping it in an iframe is only worth their effort if the iframe shows something the static image can't. So the embed splits in two:

- **As a viral loop**: only viable if it ships the minimum feature bar in §1.1. Until then, a minter has zero reason to install it over hotlinking their image.
- **As a backlink/SEO channel for us**: still worth doing — every install is a permanent inbound link from a domain we don't own, and the embed gallery doubles as social-proof for partner DMs. Treat it as a long-tail acquisition channel with a 30+ day payoff, not a launch-week KPI.

### 1.1 Minimum feature bar to be a real loop

If the embed ships less than this, demote it to backlinks-only and stop spending DM cycles on it:

| Feature | Why it matters |
|--------|----------------|
| Live owner address (truncated, links to `/u/:wallet`) | Embed updates when the region resells — owner gets free verification, viewer gets fresh data |
| Live Dutch-auction price + "Buy this region" CTA when listed | Turns the embed into a passive sales surface, owner has real economic reason to install |
| Auto-refresh on owner image swap (poll asset every ~60s, or signed-update push later) | Owner can change creative without touching their site again — this is the *only* thing a static `<img>` can't do |
| Verification badge ("Verified on Solana Billboard" + asset link) | Defends against impostor sites; gives the embed a status-symbol read |
| Footer "Get yours →" with `?ref=embed:{assetId}` attribution | Required for our half of the loop |

Without all five, the embed is a worse `<img>` tag with extra latency. Build all five or skip the loop framing entirely.

### 1.2 Funnel + targets (long-tail, not launch-week)

| Stage | Definition | Target by T+14 | Target by T+30 |
|------|------------|----------------|----------------|
| Embed code copied | "Copy embed" click | 30 | 80 |
| Embed live (verified) | Found in the wild via referrer | **10** | **30** |

If embeds-live is at zero by T+14, that's expected, not a fire. The share button (§3 rank 1) is what we measure in launch week.

### 1.3 Where the CTA lives in-product

| Surface | CTA | Priority |
|--------|-----|----------|
| `RegionSidebar` always-on | "Embed this region" sits *below* "Share" and "List for sale" — order reflects loop priority | P0 |
| `/u/:wallet` profile | "Embed your collection" widget that renders a strip of all owned regions in one iframe | P2 (week 3+, only if §1.1 features shipped) |
| `/embed/r/:assetId` itself | Footer link "Get yours →" with `?ref=embed:{assetId}` for attribution | P0 |

### 1.4 Embed gallery page (`/showcase`)

Still worth building — primarily as the social-proof asset we link to in partner DMs and the destination for `?ref=embed:` referrers. Single static page:

1. **Live embeds wall**: Auto-list of every external site detected via referrer, with screenshot, region thumbnail, "Visit site →".
2. **How to embed**: 3-line snippet, no API key.
3. **Submit your embed**: Tally form, manual approval.

Build cost ~half a day. Ship by T-3 even though embeds-live won't be the headline metric — the page becomes useful at T+30, not T+1.

### 1.5 Outreach (slimmed)

Reserve embed-specific DMs for: (a) the 20 partners from §2 who already committed to a region, and (b) any non-partner site we'd actively want a backlink from (Solana ecosystem dashboards, memecoin trackers, NFT marketplaces). Do **not** broad-DM every minter with embed asks — that bandwidth is better spent on share-button-driven amplification (§3.1).

**Template A — committed partner (T+3 nudge):**
> Your region is up — when you have 2 min, the embed snippet is `<iframe src="solanabillboard.space/embed/r/{assetId}" />`. It auto-updates if you ever swap the image, shows live price if you list it, and gets you on /showcase. Drop it in your footer or docs and I'll feature you in tomorrow's State of the Canvas thread.

**Template B — non-partner backlink target:**
> We built a free 1920×1080 NFT canvas — every region has a self-updating iframe embed (live owner, live price). If you have a footer/sidebar slot, we'll mint a region for you in exchange for the embed going live. No tokens, no equity, no follow-up.

### 1.6 Incentives

- **Featured row on /showcase** — free, scalable.
- **Boost-credit reward**: any wallet whose embed we verify in the wild gets one free GLOWING boost (0.015 SOL). Cap at 50, hand-issued, surprise-and-delight only.
- **Do NOT** pay for embeds in SOL.

### 1.7 Instrumentation (covered in §5)

Required events: `embed_copy` (client), `embed_referral_hit` (server-side via Referer header on `/embed/r/:assetId`, grouped by domain).

---

## 2. Partner Pre-Mint Funnel

Goal: **20 committed pre-mints** with creative in hand by T-2. Center-zone reservations cap at 6 partners.

### 2.1 List building (do this T-14 → T-12)

| Source | Method | Expected raw list | Yield to "warm" |
|-------|--------|-------------------|-----------------|
| Superteam DE/UK/NG/VN/IN TG admin lists | Scrape pinned messages, list of ambassadors | 60 | 12 |
| Solana Foundation grant recipients | https://solana.org/grants page (filter 2024-2026, ecosystem/consumer) | 80 | 10 |
| Memecoin CMs (BONK, WIF, popcat, MEW, retardio, michi) | Find mods in the TG via `/admins` then DM via X | 30 | 6 |
| Founder X follows | Manually pick 30 Solana-builders Darko already has 1:1 history with | 30 | 15 |
| Spaces/podcast hosts | Lightspeed, The Solana Podcast, Mert's spaces, BlockWorks Empire | 10 | 3 |
| **Total** | | **210** | **~46 → trim to top 30 → close 20** |

### 2.2 Tracking sheet shape

Single Google Sheet, one row per target. Columns:

| Column | Values |
|--------|--------|
| Handle | @x_handle |
| Segment | memecoin\_cm / project\_team / kol / superteam / podcaster |
| Tier | A (must-land, center-zone offer) / B (perimeter offer) / C (broadcast only) |
| First touch | date sent |
| Channel | x\_dm / tg\_dm / email |
| Reply state | none / opened / replied / committed / minted / embedded / shared |
| Region offered | coords or "their pick within zone" |
| Creative received | y/n + IPFS link |
| Public commit | tweet URL when they post they're in |
| Notes | free text |

### 2.3 Outreach sequence (per target, 14-day window)

| Day | Touch | Channel |
|-----|-------|---------|
| T-12 | Personalized opener (variant by segment, see below) | DM where they reply fastest |
| T-9 | Send devnet link + 30s Loom of the mint flow | Same channel |
| T-6 | "Hold your spot" — ask for region coords + image asset | Same channel |
| T-3 | Confirm mint window + tweet draft, share their region preview | Same channel |
| T-1 | Final reminder + the launch-tweet thread they need to RT | Group DM with all 20 |
| T+0 | Coordinated mint window (00:00-00:30 UTC) | Group DM |
| T+1 | "Did you embed it?" nudge | DM |

**Conversion expectations** (for budgeting time):

| Stage | Yield |
|-------|-------|
| Sent → opened | 70% (warm list) |
| Opened → replied | 50% |
| Replied → soft yes | 60% |
| Soft yes → minted at T+0 | 65% |
| **Sent → minted** | **~14%** (so ~140 sends to land 20) |

This is why the list is 30 trimmed-warm targets, not 20. Over-recruit by 50% always.

### 2.4 Outreach copy — 3 variants

**Variant 1 — Memecoin CM:**
> [name] — running growth on [billboard] launching in 14 days. We're rebuilding the Million Dollar Homepage on Solana, every region is an NFT, every owner can iframe it anywhere. I'd like to gift [community] a 20×20 region in the center zone before public mint opens, on the condition you post it from the community account on launch day. No token, no follow-up, just a permanent flag for [community] on a 20,736-block canvas. Devnet preview: [link]. Want it?

**Variant 2 — Project team:**
> Hey [name] — [billboard] flips on [date]. It's MDH on Solana, regions are MPL Core NFTs, fully on-chain bonding curve. Pre-launch we're seeding the canvas with 20 ecosystem projects so it doesn't open empty. [project] is on the shortlist — happy to gift you a 15×15 region of your choice if you'll mint in our coordinated T-0 window and embed the iframe in your site footer. Total ask: 5 minutes on launch day + an iframe tag. Devnet to play with: [link].

**Variant 3 — Solana KOL:**
> [name] — building Solana Billboard, MDH rebuild on mainnet, launches in 2 weeks. Not pitching a post — pitching a region. You get a 10×10 in a center-zone slot, pre-minted to your wallet, no strings. If it sparks something for you, post it. If not, it's still yours forever. Curious what you'd put in the pixels.

Each variant: <90 words, ends with a question, no link unless they reply.

### 2.5 Center-zone vs perimeter triage

Center zone = 60×34 = 2,040 blocks at flat 0.0005 SOL. Reserve **30%** (~600 blocks) for partners. Cap at 6 Tier-A partners with regions up to 20×20.

| Tier | What they get | Who qualifies |
|------|--------------|---------------|
| A (center, up to 20×20) | Free pre-mint inside center zone | Partner with >= 50K reach AND a public commit to post launch day AND an embed install promised |
| B (perimeter, up to 15×15) | Free pre-mint anywhere outside center | Partner with public commit OR known embed surface |
| C (perimeter, up to 10×10) | Free pre-mint in curve zone | Symbolic seed for warm relationships, no obligation |

Center-zone allocation is **publicly disclosed in a pinned tweet at T-1** with the partner list. The fair-launch credibility depends on never appearing to hide an allocation.

---

## 3. Viral Loops (Ranked by Leverage)

Four loops, ranked. The share button is the primary loop on day 1 because it's the only one that converts an existing economic action (mint, edit, boost, list) into a broadcast by someone who has skin in the game. Everything else is leverage on top.

### Rank 1 — Screenshot-to-tweet share button in `RegionSidebar` (PRIMARY LOOP)

Already in roadmap (memory note: ~1 day build). **This is the launch.** If exactly one feature ships, it's this one.

#### 3.1.1 What it does

A "Share" button at the top of `RegionSidebar` (above "Embed" and "List for sale") generates a branded PNG of the region + opens a Twitter Web Intent URL with caption + link prefilled. One click, one tweet, screenshot attached.

#### 3.1.2 Trigger moments — auto-prompt vs always-available

The button is **always visible** in the sidebar for the region's owner. On top of that, four moments fire an **auto-prompt** (a non-blocking toast inside the sidebar, dismissable, max one prompt per session per region):

| Moment | Hook | Toast copy | Why auto-prompt |
|--------|------|-----------|-----------------|
| Post-mint | `useMintRegion.onSuccess` | *"You planted a flag. Show it off?"* + Share button | Highest emotional peak in the funnel; minter just spent SOL and is staring at their region |
| Post-image-update | `useUpdateRegionImage.onSuccess` | *"New creative live. Drop it on Twitter?"* | Owner explicitly cared enough to swap art — shipping behavior, broadcast moment |
| Post-boost (any flag) | `useBuyBoost.onSuccess` | *"Boost is live for 24h. Tell people to look?"* | Boost decays — owner has economic reason to drive eyeballs *now* |
| Post-listing-create | `useCreateListing.onSuccess` | *"Listing is live. Share the auction?"* | Dutch auctions need traffic to clear; owner wants buyers |

Boost re-buys (timestamp extends) do **not** re-trigger the prompt — only the first activation in a 24h window. Listing cancellations and purchases-as-buyer do not prompt either; nothing to broadcast.

#### 3.1.3 Screenshot generation approach

**Recommended: full canvas with the region highlighted, cropped to ~32×32 blocks of context around the region (clamped to canvas edges).** This composite outperforms either extreme:

- A bare region clip (region + 2 blocks of context) loses the "I'm part of a thing" frame and looks like a generic image — kills the curiosity click on Twitter.
- A full 1920×1080 canvas screenshot makes the region invisible at Twitter card scale.
- Cropped-canvas-with-highlight gets both: viewer sees the region clearly + sees it embedded in a populated canvas (social proof). Add a 2px teal border around the highlighted region + bottom strip with "solanabillboard.space" + the (x,y) coords.

Generate client-side from the existing `PixelCanvas` — `loadedImages` and `animatedImages` are already in `RegionContext`, just paint to an offscreen canvas at 2x DPI and `toBlob()`. No server dependency.

#### 3.1.4 Tweet copy templates (parametric, one per trigger)

Pre-fill via Twitter Web Intent, owner can edit before posting:

| Trigger | Default text |
|--------|-------------|
| Post-mint | `I planted a flag on @solanabillboard 🪩\n\n{block_count} pixels at ({x},{y}) — pick yours before they fill\n\nsolanabillboard.space/?region={assetId}` |
| Post-image-update | `Updated my region on @solanabillboard 👇\n\nsolanabillboard.space/?region={assetId}` |
| Post-boost | `My region is boosted on @solanabillboard for the next 24h 🔥\n\nsolanabillboard.space/?region={assetId}` |
| Post-listing | `Listing my region on @solanabillboard — Dutch auction, price drops every block until someone takes it\n\nsolanabillboard.space/?region={assetId}` |

Drop `@solanabillboard` if the handle isn't claimed by T-3.

#### 3.1.5 Instrumentation

- `share_prompt_shown` (off-chain): toast displayed
- `share_button_click` (off-chain): owner clicked Share (from prompt OR always-on button)
- `share_intent_opened` (off-chain): Twitter Web Intent window opened (close approximation of "tweet sent" — Twitter doesn't give us the actual post callback)
- North-star derivation: `unique_minters_with_share_intent_within_7d / unique_minters` measured weekly. Target ≥0.55 by T+14d.

#### 3.1.6 Leverage

Without this, ~80% of minters never tell anyone. With it, each mint becomes a tweet, each tweet has the screenshot, and each screenshot has the canvas frame doing latent advertising for the next mint. This is the loop the launch lives or dies on.

### Rank 2 — Hourly canvas timelapse → composite videos

Already in roadmap (memory note). Server-side cron screenshots the canvas every hour.

- T+72h: 30s timelapse of the first 3 days, post on X.
- T+7d, T+14d, T+30d: progressively longer cuts.
- Final asset: a 60s "fill of the canvas" to seed r/InternetIsBeautiful, TikTok, and HN at month 1.
- **Leverage**: Free perpetual content engine. Decouples narrative momentum from "did anything new happen today." Mid leverage during launch week (no fill to show yet) but compounds heavily by week 2.

### Rank 3 — Region "neighborhood" mentions

Build a tiny feature: when a region is selected, the sidebar shows the 4 adjacent regions with their owner handles (truncated wallet or `/u/:wallet`). On mint, fire a notification (in-app first, optional email later) to the 4 neighbors: *"You have a new neighbor — [region]"*.

- Net effect: Every mint pings 4 existing owners. They reload the canvas to see who arrived. Repeat-visit driver.
- Builds the canvas as a place, not a database.
- **Leverage**: Only kicks in once the canvas is partially populated (week 2+). Buildable in 2-3 days. Ship if engineering has slack.

### Rank 4 — Embed widget (long-tail, see §1)

Demoted from primary loop because the static `<img>` substitute is too good unless the embed ships the §1.1 feature bar (live owner, live price, auto-refresh, verification badge, attribution footer). Until then it's a backlink/SEO play, not a viral loop.

- **Leverage**: Compounds slowly over months. Useful for SEO and partner social proof. Not a launch-week KPI.

### Rejected for launch window

- **Referral codes / fee splits** — incompatible with fair-launch narrative.
- **Token airdrops to early minters** — flips the audience from collectors to farmers.
- **Leaderboards by SOL spent** — invites whales to dominate the narrative; we want the canvas to feel populated, not whale-captured.

---

## 4. Twitter Draw Mechanics

Three pre-saturation draws (0.2 / 0.3 / 0.5 SOL). Each is the awareness push for the *next* milestone, not just a payout.

### 4.1 Tweet template (parametric)

**Trigger tweet** (posted at the moment the milestone hits):

```
{milestone}% of the canvas is minted.

That triggers the {prize} SOL draw.

To enter:
1. Follow @solanabillboard
2. RT this tweet
3. Reply with your region's asset ID

Eligible: any region 10×10 or larger. Drawn {time} UTC by {method}.

Next prize at {next_milestone}%: {next_prize} SOL.

[screenshot of canvas with milestone overlay]
```

Constraints:
- Always shows the **next** prize and the **next** milestone — every draw is also the next draw's announcement.
- Always includes the live canvas screenshot (auto-grabbed from the timelapse cron — no manual asset).
- Always links to the treasury wallet on Solscan in the first reply, screenshot of balance.

### 4.2 Eligibility + fraud resistance

| Rule | Why |
|------|-----|
| Region must be 10×10 (100 blocks) minimum | Floor entry cost ~0.004 SOL minimum, kills bot grinding |
| Region must be minted before the milestone tweet timestamp | Stops snipe-after-the-fact entries |
| Asset ID in the comment must resolve to a region owned by the commenting account's connected wallet | Verified via a 1-line script reading the asset on-chain; no honor system |
| Follow + RT verified by Twitter API at draw time, not entry time | Account that follows-then-unfollows still wins, that's fine |
| Winner selection: published seed = SHA256(milestone tweet ID + Solana slot at draw time) | Verifiable, no third-party dep |

Publish the selection script as a public gist *before* the first draw. The commitment to the method has to predate the draw or it isn't credible.

### 4.3 Post-draw transparency

Every draw triggers a 4-tweet thread:
1. Winner announcement + Solscan link to the payout tx.
2. Selection method recap + link to the script + the seed inputs.
3. List of total entries + list of valid entries (those filtered out get an explanation).
4. Next milestone framing: *"{next_milestone}% unlocks {next_prize} SOL. Currently at {current}%."*

### 4.4 Draw timing

Wait **24h after milestone hit** before drawing. This:
- Gives the tweet a full day to circulate.
- Lets late entrants buy in (additional mints).
- Creates a second spike of attention on the actual draw.

---

## 5. Funnel Instrumentation

Solana-native users are allergic to third-party trackers, cookie banners, and SaaS analytics. Anything below wallet-connect is already on-chain ground truth — we don't need PostHog to recount what the program logs already tell us. Above wallet-connect we need exactly enough to know whether the landing page is converting.

### 5.1 Recommended stack

**Primary recommendation: Plausible Cloud ($9/mo).** No cookies, no PII, no banner, GDPR-compliant by default, set up in 10 minutes with a single script tag. Pre-aggregated dashboards we can make public, which doubles as transparency content for launch week ("here's our live funnel").

**Privacy-maximalist alternative: self-hosted Umami.** ~$5/mo on a tiny VPS, fully owned data, same no-cookie posture. Pick this only if Darko wants the SaaS-zero stance for narrative reasons; otherwise the 30 minutes of self-host setup isn't worth it pre-launch.

**Dropped: PostHog.** Cookie banner overhead, SaaS dependency in the launch loop, session recordings/feature flags/cohorts overlap with what `useProgramTransactions` already gives us for free. The funnel below wallet-connect (mints, wallets, listings, boosts, purchases) is fully observable on-chain. PostHog's only real edge is the pre-wallet funnel — and Plausible covers that with no privacy tax.

### 5.2 Instrumentation map — two sources of truth

#### 5.2a Off-chain (Plausible) — strictly above wallet-connect

These are the only events we send to a third party. Everything else is on-chain.

| Event | Where to fire | Why |
|-------|--------------|-----|
| `pageview` (`/`, `/u/:wallet`, `/activity`, `/embed/r/:assetId`) | Auto via Plausible script | Acquisition denominator |
| `scroll_50` / `scroll_90` on `/` | Plausible custom event from scroll listener in `Index.tsx` | Did the landing page hold attention or bounce above the fold |
| `wallet_connect_clicked` | `WalletButton` click in `CanvasToolbar` (before SDK takes over) | Above-fold CTA conversion |
| `purchase_panel_opened` | `PurchasePanel` mount | Last off-chain step before mint intent |
| `share_intent_opened` | Share button in `RegionSidebar` (Twitter Web Intent window opened) | Closest proxy to "tweet sent" — Twitter doesn't expose post callback |
| `embed_copy` | "Copy embed" click | Long-tail loop signal |
| `embed_referral_hit` | Server-side log on `/embed/r/:assetId` requests, grouped by `Referer` domain | Embeds-in-the-wild |

Plausible referrer + UTM auto-tags every pageview. No need for explicit `landing_view` events.

Implementation: a `track(event, props)` helper in `src/lib/analytics.ts` that calls `window.plausible?.(event, { props })` — no-ops if Plausible script hasn't loaded, never blocks UI, never breaks if the user has a tracker blocker (which many Solana wallets ship by default — that's fine, on-chain data is the source of truth).

#### 5.2b On-chain ground truth — derived from existing hooks/accounts

Every metric below comes from code we already ship. No third-party dependency.

| Metric | Source in codebase | How to derive |
|--------|--------------------|---------------|
| Total mints | `useOnChainRegions` | `regions.length` |
| Mints in last N hours | `useProgramTransactions` | filter signatures by `MintRegion` log + `blockTime > now - N*3600` |
| Unique minting wallets | `useOnChainRegions` | `new Set(regions.map(r => r.owner)).size` |
| Repeat minters (≥2 regions) | Same | group regions by owner, count owners with ≥2 |
| Blocks sold / % canvas | `useCanvasState` | `canvas.curveBlocksSold + center_blocks_sold` / 20736 |
| Mint pulse (per hour) | `useProgramTransactions` | bucket signatures by hour |
| Active boosts | Boosts PDAs (already in cache) | count where `now - at < 86_400` per flag |
| Active listings | `useOnChainRegions` (listing field) | filter regions with non-null listing |
| Listings cleared (dutch auction filled) | `useActivityEvents` | parse `ExecutePurchase` events |
| Treasury revenue | Treasury wallet on Solscan | direct chain read |
| Wallets that minted within Nh of connecting | `useProgramTransactions` ∩ Plausible `wallet_connect_clicked` | join on wallet address (only if the wallet later mints — pre-mint wallets are anonymous, by design) |

Build a single founder-facing **`/admin/pulse`** page (gated to Darko's wallet via signature) that renders these from the same React Query hooks the app already uses. No new infra. Updates live as the canvas fills.

### 5.3 Conversion rate definitions

Wallet-connect → mint, properly defined:

- **Numerator (on-chain ground truth)**: `unique wallets in useProgramTransactions with a MintRegion log within the window`.
- **Denominator (off-chain)**: `unique sessions firing wallet_connect_clicked in the same window` from Plausible.
- **Window**: rolling 24h, measured at the same UTC hour daily.
- **Caveat**: Plausible undercounts (tracker blockers); on-chain overcounts (wallets that connected before the window started, minted inside it). Both biases shrink the ratio. **Treat the printed number as a *floor*, not a precise rate.** Trend-over-time is the signal; absolute level is approximate.

### 5.4 The 8% target — denominator, window, abort

Ported forward from the earlier instrumentation pass:

- **Definition**: `mints_in_24h / wallet_connect_clicked_in_24h ≥ 0.08`.
- **Window**: First 24h after public mint opens (T+1:00 → T+25:00).
- **Floor**: 5%. Below floor at T+24h ⇒ activation surgery (kill drop-off steps in the mint flow), not more top-of-funnel traffic.
- **Abort condition**: Below 3% AND fewer than 40 unique connecting wallets ⇒ the public marketing push is wasted spend. Switch to 1:1 partner recovery only (mirrors the §7.2 T+24:00 abort).

### 5.5 Dashboard cuts that matter

Three views on `/admin/pulse`. No more.

1. **Acquisition funnel** (Plausible + on-chain): pageviews → `wallet_connect_clicked` → unique wallets that minted in the same 24h window. Step CRs displayed as floors per §5.3.
2. **Hourly mint pulse** (on-chain): mints per hour + cumulative blocks sold + % of canvas + projected milestone-hit times. This is what Darko watches in the war room.
3. **Wallet retention cohort** (on-chain): cohort by mint date, retention via repeat actions (boost, list, second mint) at D1/D7/D14. One-and-done vs sticky.

Embed/share loop metrics live in the Plausible dashboard directly — no need to duplicate.

### 5.6 Feature flags and kill-switches (no SaaS)

If we need to gate features (kill the embed CTA, hide a broken boost flag, freeze listings), use a 50-line config file checked into the repo plus a build-time env var override. Concretely:

- `src/config/flags.ts` exporting a typed `FLAGS` object with boolean defaults.
- Each flag overridable via `VITE_FLAG_<NAME>` env var.
- A redeploy flips the flag (Vercel/Netlify deploys are <2 min — fast enough for the war room).
- For true emergency kills (NSFW image hotfix, broken pricing display), a `localStorage` admin override keyed to Darko's wallet signature lets the kill ship before redeploy lands.

No LaunchDarkly, no PostHog feature flags, no SaaS in the kill-switch path.

---

## 6. Anti-Patterns (Do NOT Do These)

These tactics look attractive in week 1 and would actively damage the moat.

| Anti-pattern | Why it kills you |
|-------------|------------------|
| **Paid KOL shills** | Solana Twitter detects paid posts in <2h. One outed shill = the "rug-friendly project" tag for the duration. Never pay for posts in launch week. Free regions in exchange for *honest* coverage are fine and traceable. |
| **Wash-trading the secondary market** to make Dutch auctions look active | The `executePurchase` path is fully on-chain and traceable. One person noticing wallet A buying wallet A's region kills the credibility of every future stat we publish. The mitigation in the launch plan ("founder seeds 3-5 listings at honest prices") is fine — *listing* is not washing. Buying your own listings is. |
| **Hidden team allocation in the center zone** | Center zone reservation is fine, *if disclosed in a pinned tweet at T-1 with the partner list*. Any region minted to a wallet not on that list before public mint opens will be screencapped and used against us. |
| **"Web3 advertising platform" framing** | Invites the regulatory/ad-tech audience and repels the nostalgia/fair-launch audience. Every press piece must lead with MDH. The word "advertising" should not appear on the landing page or in any official tweet. |
| **Token speculation pre-talk** | We have no token. Do not hint at one. Do not say "for now." Do not say "future utility." The moment "is there a token?" enters the conversation, the audience shifts from collectors to farmers and the canvas dies. |
| **Paid ads in launch week** | Already ruled out. Worth restating: any paid acquisition in the first 14 days corrupts the funnel data and signals weakness. After day 14, retargeting paid (not cold) ads can be tested. |
| **Engagement-bait threads** ("RT for a chance to mint!") | Conflicts with the actual draw mechanic and trains the audience to expect bot-grinding rewards. The 3 Twitter draws are the only sweepstakes mechanic, period. |
| **Pivoting the narrative under early pressure** | If T+24h numbers are below floor, the response is *more outreach*, not *new positioning*. The MDH narrative is load-bearing. Changing it mid-launch tells the audience we don't believe it either. |
| **Begging for retweets in DMs** | One-shot ask only. Following up with "could you RT this too" burns the relationship. Partners commit upfront or they don't. |
| **Spam in Solana TGs** | Every Superteam TG has a posting etiquette. Read pinned messages. Coordinate with admins, post once, do not cross-post across countries within 48h. |

---

## 7. First-72-Hour War Room

Solo operator (Darko) + Claude agents. All times UTC. "Claude" below = a delegated agent task with a clear output, not Darko's hands.

### 7.1 Pre-launch night (T-1)

| Time | Action | Owner |
|------|--------|-------|
| 18:00 | Final partner DM sweep — confirm all 20 will mint in T+0 window | Darko |
| 19:00 | Pinned tweet: center-zone partner list, disclosure, treasury wallet screenshot | Darko |
| 20:00 | Treasury check: 2.1 SOL in prize wallet, PrizeVault PDA funded with 1 SOL on-chain | Darko |
| 21:00 | Instrumentation smoke test: trigger every off-chain event in §5.2a on devnet, confirm landing in Plausible; verify `/admin/pulse` reads on-chain ground truth | Claude |
| 22:00 | Sleep. Set alarm for T-0:30. Do not push code. | Darko |

### 7.2 T-0 to T+24 (hour-by-hour)

| Hour | Action | Trigger to escalate | Abort condition |
|------|--------|---------------------|-----------------|
| T-0:30 | War-room channel open (TG group with founder + 2 trusted observers) | — | — |
| **T+0:00** | Mainnet program flip; partner mint window opens (closed mint via off-chain coordination, public mint stays gated 60 min) | Any partner reports failed mint → call in eng help | If >3 partners fail mints, halt public open and debug |
| T+0:15 | Confirm 10+ partner mints landed; screenshot canvas | <5 partner mints landed → DM remaining partners directly | If <8 by T+0:55, push public open by 30 min and recruit 5 more partners from B-tier |
| **T+1:00** | Public mint opens. Launch tweet from founder + canvas screenshot showing partner logos | Tweet impressions <2k in first 30 min → ask 3 KOLs to QT | — |
| T+1:30 | Partner RT wave — pinned message in T-1 group DM goes out: "post now" | <50% partner posts live by T+2:00 → 1:1 nudge | — |
| T+2:00 | Reddit r/solana drop (founder-story format, not announcement) | Comments hostile within 30 min → Darko replies to top 5 personally before doing anything else | — |
| T+3:00 | First "State of the Canvas" tweet: blocks sold, wallets, top 3 regions | Mint pulse <20/hr → trigger memecoin TG posts | — |
| T+4:00 | Open Telegram + Discord links in landing page banner | TG/DC join rate <5/hr → not a problem, we have 2 weeks | — |
| T+6:00 | Twitter Spaces or TG voice with 1-2 confirmed KOLs (booked T-7) | KOL no-shows → Darko hosts solo, frame as "casual AMA" | — |
| T+8:00 | Founder AMA in Telegram. Answer every question, even hostile ones, in public | Coordinated FUD detected (multiple new accts, same talking points) → Pin a single response, don't escalate | — |
| T+10:00 | Eat. Hydrate. Set 90-min sleep cycle for T+12 to T+18. | — | — |
| T+12:00 to T+18:00 | Sleep + monitor pings only. One trusted observer keeps watch in war-room channel. | Critical bug or NSFW upload → wake Darko | — |
| T+18:00 | Wake. Check overnight metrics. Post wake-up tweet: "Asia woke up. Here's what 18 hours looks like" + canvas screenshot. | — | — |
| T+20:00 | DM every wallet that minted >100 blocks with embed Template A | <10 qualifying wallets → use B-tier partner list | — |
| T+22:00 | First moderation pass on uploaded images | NSFW found → use takedown flow, post one transparency tweet | — |
| **T+24:00** | End-of-day-1 thread: blocks sold, wallets, embeds counted, top 5 regions, what's next. **Check 25% milestone proximity** — if within 5%, prep the 0.2 SOL draw tweet. | <8% saturation → ship "lower the bar" thread reframing the metric as embeds, not blocks | If <2% saturation AND <40 wallets, abort the public marketing push, switch to 1:1 partner recovery only |

### 7.3 Day 2 (T+24 to T+48)

| Time | Action |
|------|--------|
| 09:00 | Daily State of the Canvas tweet |
| 10:00 | Region Spotlight #1 — pick the most creative region from day 1, write a 4-tweet thread about the owner |
| 12:00 | Reach out to 5 podcasts/spaces for a week-1 booking |
| 14:00 | Embed outreach batch (10 DMs to qualifying minters) |
| 16:00 | Founder reply-guy session — 60 min of replying to every Solana KOL who tweeted about attention/canvas/MDH |
| 18:00 | Check 25% milestone — if hit, fire draw tweet. If close, tease it ("X blocks from the first 0.2 SOL draw") |
| 20:00 | Day 2 wrap thread |

### 7.4 Day 3 (T+48 to T+72)

| Time | Action |
|------|--------|
| 09:00 | Daily State of the Canvas tweet — include 48h numbers vs targets in §4 of launch plan |
| 11:00 | Reddit r/CryptoCurrency story-format post |
| 13:00 | Region Spotlight #2 |
| 15:00 | Embed outreach batch + re-DM unresponsive partners |
| 17:00 | First Dutch-auction resale watch — if one happens, document and tweet immediately (founder seeds 1 listing if none exist) |
| 19:00 | Twitter Space or X Live with one Solana KOL (booked T+1) |
| 21:00 | 72h retro thread: what worked, what didn't, what's next week |

### 7.5 Escalation matrix (active throughout)

| Signal | Action |
|--------|--------|
| Mint pulse drops below 10/hr for 2 consecutive hours | Memecoin TG post + 5 KOL DMs |
| Wallet→mint conversion <5% per §5.4 | UX surgery: kill any mint-flow steps shown to be drop-offs in the Plausible funnel; on-chain numerator is authoritative |
| FUD thread gaining traction | Single calm reply from Darko, do not delete, do not escalate |
| NSFW / IP complaint | Takedown via flag flow within 4h, transparency tweet within 24h |
| Bot detected sniping center zone | Public post with on-chain evidence, no apology, frame as "this is why we pre-allocated to partners" |
| Embed count flat at 48h | Ship the embed gallery early, run a /showcase tweet + DM blitz |

### 7.6 Alex Tew contingency (overlay on entire schedule)

| Outcome | Action | When |
|---------|--------|------|
| Replies "yes, want a region" | Pre-mint to his wallet T-1, coordinate his post for T+1h, lead the launch tweet with his quote | Drop everything else within reason |
| Replies neutral / curious | Send a 60s Loom + one follow-up only. If silence, assume he's a no | T-3 latest |
| Tweets without minting | Quote-tweet within 15 min, frame as "the original creator weighing in" | Real-time |
| Replies negative / objects to MDH branding | Strip every direct MDH reference from launch comms within 2h. Reframe as "fair-launch pixel canvas" | Pre-launch only |
| Ignores | Send one follow-up T-3, then drop. Do not mention him publicly. | T-3 |

A positive Alex signal is the only thing that should cause us to rewrite the launch tweet at the last minute. Everything else holds.

---

## Appendix: Single-page priority stack

If only 5 things ship, ship these in order:

1. **Share button + screenshot generator** in `RegionSidebar` with the four auto-prompt triggers from §3.1.2 (the primary loop — every other lever leans on this)
2. **20 partner pre-mints booked** by T-2 (cold-start fuel, gives the share button something to broadcast)
3. **Plausible script + `/admin/pulse` page** wired to existing on-chain hooks per §5 (we cannot improve what we can't see, and we cannot ship a SaaS dependency in the launch loop)
4. **Alex Tew email at T-10** (asymmetric upside, zero cost)
5. **`/showcase` embed gallery page** (social proof + partner DM asset; long-tail backlink channel, not launch-week KPI)

Everything else in this doc is leverage on top of these five.
