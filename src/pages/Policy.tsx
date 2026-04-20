import { Link } from "react-router-dom";
import { ArrowLeft, ShieldAlert } from "lucide-react";
import WalletButton from "@/components/WalletButton";
import WalletBalances from "@/components/WalletBalances";
import logo from "@/assets/logo.png";

const TAKEDOWN_URL =
  (import.meta.env.VITE_TAKEDOWN_URL as string | undefined)?.trim() || "";
const CONTACT_EMAIL =
  (import.meta.env.VITE_MODERATION_CONTACT as string | undefined)?.trim() ||
  "hello@solanabillboard.space";

const Policy = () => (
  <div className="flex flex-col min-h-screen bg-background">
    <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <Link to="/" className="shrink-0" aria-label="Home">
          <img src={logo} alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-md ring-1 ring-primary/20" />
        </Link>
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight leading-none truncate">
            <ShieldAlert className="inline w-4 h-4 text-primary mr-1.5 -mt-0.5" aria-hidden="true" />
            <span className="text-foreground">Content Policy</span>
          </h1>
          <Link
            to="/"
            className="hidden sm:inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary tracking-wider uppercase mt-1 transition-colors"
          >
            <ArrowLeft className="w-2.5 h-2.5" aria-hidden="true" /> Back to canvas
          </Link>
        </div>
      </div>
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="hidden md:block">
          <WalletBalances />
        </div>
        <WalletButton />
      </div>
    </header>

    <main className="flex-1 overflow-auto">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12 prose prose-invert prose-sm">
        <p className="text-sm text-muted-foreground">
          Solana Billboard is a permissionless on-chain primitive. The canvas lives on Solana,
          and <strong>solanabillboard.space</strong> is one of many possible frontends that renders it.
          This page describes what <em>this frontend</em> will and will not display, and how to
          report content.
        </p>

        <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">What the NFT layer does</h2>
        <p className="text-sm text-muted-foreground">
          Anyone can mint a region and point it at any image URI. The NFT and its metadata are
          permanent — neither we nor anyone else can censor the on-chain asset.
        </p>

        <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">What this frontend does</h2>
        <p className="text-sm text-muted-foreground">
          We render the canvas as a hosted product, and we moderate what our frontend shows.
          Reported regions that violate the rules below are replaced with a neutral placeholder —
          the image is not displayed on solanabillboard.space and the image pin is removed
          from our Pinata account. The region, its ownership, and its listings remain visible.
        </p>

        <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">Disallowed content</h2>
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-6">
          <li>Child sexual abuse material (CSAM) — zero tolerance, removed on sight.</li>
          <li>Non-consensual intimate imagery.</li>
          <li>Doxxing: private addresses, phone numbers, financial data, or government IDs.</li>
          <li>Direct incitement of violence or credible threats toward specific people.</li>
          <li>Malware, phishing kits, or links to sites hosting them.</li>
          <li>Infringing copyrighted material or trademarks used to impersonate brands.</li>
          <li>Content that violates US or EU law in ways that expose our infrastructure providers
            to liability.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">What we don't moderate</h2>
        <p className="text-sm text-muted-foreground">
          Memes, strong opinions, crypto projects we personally don't like, NSFW-but-legal art,
          and regions that just look ugly. This is a billboard, not a gallery.
        </p>

        <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">How review works</h2>
        <ul className="text-sm text-muted-foreground space-y-1.5 list-disc pl-6">
          <li>Response SLA: <strong>24 hours</strong> for most reports, <strong>4 hours</strong>{" "}
            for CSAM or imminent-harm reports.</li>
          <li>If we take a region down, the decision and date are logged internally.</li>
          <li>Owners can appeal to the contact address below. Good-faith appeals get a response.</li>
          <li>We publish the hidden list publicly so the decisions are auditable.</li>
        </ul>

        <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">Report a region</h2>
        <p className="text-sm text-muted-foreground">
          {TAKEDOWN_URL ? (
            <>
              Use the{" "}
              <a
                href={TAKEDOWN_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                report form
              </a>{" "}
              or email{" "}
            </>
          ) : (
            <>Email </>
          )}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          {" "}with the region URL or asset ID, the reason (IP / NSFW / illegal / other), and any
          evidence. Anonymous reports are accepted; reports with a contact address get a reply.
        </p>

        <h2 className="text-lg font-semibold text-foreground mt-8 mb-2">Appeals</h2>
        <p className="text-sm text-muted-foreground">
          If your region was hidden and you believe it shouldn't have been, email{" "}
          <a href={`mailto:${CONTACT_EMAIL}`} className="text-primary hover:underline">
            {CONTACT_EMAIL}
          </a>
          {" "}with the asset ID and your case. We aim to respond within 72 hours.
        </p>

        <p className="text-xs text-muted-foreground mt-10 pt-4 border-t border-border">
          This policy applies to solanabillboard.space only. If you disagree with our moderation
          choices, the on-chain NFT remains visible through any other frontend or block explorer.
        </p>
      </div>
    </main>
  </div>
);

export default Policy;
