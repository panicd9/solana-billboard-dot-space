import { Link } from "react-router-dom";
import { MousePointerSquareDashed, ImageIcon, Sparkles } from "lucide-react";
import logo from "@/assets/logo.png";
import Countdown from "@/components/Countdown";
import ComingSoonCanvas from "@/components/ComingSoonCanvas";

// Thu Apr 23, 2026 · 16:00 CEST (Belgrade) = 14:00 UTC
const LAUNCH_AT = new Date(Date.UTC(2026, 3, 23, 14, 0, 0));

const X_URL = (import.meta.env.VITE_X_URL as string | undefined)?.trim();
const GITHUB_URL = (import.meta.env.VITE_GITHUB_URL as string | undefined)?.trim();

const launchDisplay = LAUNCH_AT.toLocaleString("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
  timeZoneName: "short",
});

const ComingSoon = () => {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Ambient gradient */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 -z-10"
        style={{
          background:
            "radial-gradient(ellipse 80% 50% at 50% 0%, hsl(187 100% 45% / 0.10), transparent 70%), radial-gradient(ellipse 60% 40% at 50% 100%, hsl(40 90% 61% / 0.06), transparent 70%)",
        }}
      />

      <header className="shrink-0 px-4 sm:px-8 py-5">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 cursor-pointer group">
            <img
              src={logo}
              alt="Solana Billboard"
              className="w-8 h-8 rounded-md ring-1 ring-primary/20 transition-all group-hover:ring-primary/50"
            />
            <span className="text-sm sm:text-base font-semibold tracking-tight">
              <span className="text-primary text-glow">Solana</span>
              <span className="text-foreground">billboard</span>
            </span>
          </Link>
        </div>
      </header>

      <main className="flex-1">
        <section className="mx-auto max-w-6xl px-4 sm:px-8 pt-4 sm:pt-8 pb-16 sm:pb-24">
          <div className="flex flex-col items-center text-center">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/5 px-3 py-1 font-mono text-[10px] sm:text-xs uppercase tracking-widest text-primary">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inset-0 rounded-full bg-primary opacity-75 animate-ping" />
                <span className="relative inline-block w-1.5 h-1.5 rounded-full bg-primary" />
              </span>
              Coming to Solana mainnet
            </span>

            <h1 className="mt-6 text-4xl sm:text-6xl md:text-7xl font-semibold tracking-tight leading-[1.05] max-w-4xl">
              Own pixels on{" "}
              <span className="text-primary text-glow">Solana</span>.
            </h1>

            <p className="mt-5 max-w-2xl text-base sm:text-lg text-muted-foreground leading-relaxed">
              A public billboard where anyone can claim a region, upload an
              image, link it anywhere, and trade it on-chain.
            </p>

            <div className="mt-10 sm:mt-12">
              <Countdown target={LAUNCH_AT} />
            </div>

            <p className="mt-5 font-mono text-xs sm:text-sm text-muted-foreground tracking-wide">
              {launchDisplay}
            </p>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                to="/preview"
                className="cursor-pointer inline-flex items-center gap-2 rounded-md bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                Preview the billboard
              </Link>
              {X_URL && (
                <a
                  href={X_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="cursor-pointer inline-flex items-center gap-2 rounded-md border border-border bg-card/60 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <svg
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                    className="w-4 h-4 fill-current"
                  >
                    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                  </svg>
                  Follow on X
                </a>
              )}
            </div>
          </div>

          <div className="mt-16 sm:mt-20">
            <ComingSoonCanvas />
            <p className="mt-3 text-center font-mono text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">
              1920 × 1080 pixels · one public canvas
            </p>
          </div>
        </section>

        <section className="border-t border-border/60">
          <div className="mx-auto max-w-6xl px-4 sm:px-8 py-16 sm:py-24">
            <div className="mb-10 sm:mb-14 text-center">
              <span className="font-mono text-[10px] sm:text-xs uppercase tracking-widest text-muted-foreground">
                How it works
              </span>
              <h2 className="mt-3 text-2xl sm:text-3xl font-semibold tracking-tight">
                Three steps. On-chain from day one.
              </h2>
            </div>
            <ol className="grid gap-4 sm:gap-6 sm:grid-cols-3">
              <Step
                index="01"
                icon={<MousePointerSquareDashed className="w-5 h-5" />}
                title="Mint"
                body="Drag to select a rectangular region. Pay in SOL. The pixels are yours as an NFT."
              />
              <Step
                index="02"
                icon={<ImageIcon className="w-5 h-5" />}
                title="Customize"
                body="Upload an image or GIF, attach a link, and your region goes live on the public canvas."
              />
              <Step
                index="03"
                icon={<Sparkles className="w-5 h-5" />}
                title="Boost & resell"
                body="Buy boosts to get featured, or list your region on the built-in Dutch-auction marketplace."
              />
            </ol>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 px-4 sm:px-8 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
          <span className="font-mono">solanabillboard.space</span>
          <div className="flex items-center gap-5">
            <Link to="/policy" className="cursor-pointer hover:text-foreground transition-colors">
              Policy
            </Link>
            {X_URL && (
              <a
                href={X_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer hover:text-foreground transition-colors"
              >
                X
              </a>
            )}
            {GITHUB_URL && (
              <a
                href={GITHUB_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="cursor-pointer hover:text-foreground transition-colors"
              >
                GitHub
              </a>
            )}
          </div>
        </div>
      </footer>
    </div>
  );
};

const Step = ({
  index,
  icon,
  title,
  body,
}: {
  index: string;
  icon: React.ReactNode;
  title: string;
  body: string;
}) => (
  <li className="group relative rounded-xl border border-border bg-card/40 p-6 transition-colors hover:border-primary/40 hover:bg-card/70">
    <div className="flex items-center justify-between">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {index}
      </span>
      <span className="flex h-9 w-9 items-center justify-center rounded-md border border-border bg-background/60 text-primary transition-colors group-hover:border-primary/40">
        {icon}
      </span>
    </div>
    <h3 className="mt-6 text-lg font-semibold tracking-tight">{title}</h3>
    <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
      {body}
    </p>
  </li>
);

export default ComingSoon;
