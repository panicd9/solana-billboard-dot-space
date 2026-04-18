import { useMemo } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Copy, ExternalLink, Sparkles, Zap, TrendingUp, Tag } from "lucide-react";
import { toast } from "sonner";
import { useWalletConnection } from "@solana/react-hooks";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import WalletButton from "@/components/WalletButton";
import WalletBalances from "@/components/WalletBalances";
import RegionMiniMap from "@/components/RegionMiniMap";
import { useRegions } from "@/context/RegionContext";
import { calculateListingCurrentPrice, formatSol } from "@/solana/pricing";
import logo from "@/assets/logo.png";
import type { Region } from "@/types/region";

const shortAddr = (a: string) => `${a.slice(0, 4)}…${a.slice(-4)}`;

// Two-stop gradient derived from wallet address. Deterministic per address.
const avatarGradient = (addr: string): string => {
  let h1 = 0;
  for (let i = 0; i < Math.min(addr.length, 16); i++) h1 = (h1 * 31 + addr.charCodeAt(i)) >>> 0;
  const hueA = h1 % 360;
  const hueB = (hueA + 80 + (h1 % 140)) % 360;
  return `linear-gradient(135deg, hsl(${hueA} 70% 55%), hsl(${hueB} 75% 45%))`;
};

const Profile = () => {
  const { wallet: walletParam } = useParams<{ wallet: string }>();
  const navigate = useNavigate();
  const { regions, isLoading, setSelectedRegion } = useRegions();
  const { wallet: connectedWallet } = useWalletConnection();
  const connected = connectedWallet?.account?.address;

  const addr = walletParam ?? "";
  const valid = addr.length >= 32 && addr.length <= 44;
  const isSelf = connected === addr;

  const owned = useMemo(
    () => regions.filter((r) => r.owner === addr),
    [regions, addr]
  );

  const stats = useMemo(() => {
    const blocks = owned.reduce((acc, r) => acc + r.width * r.height, 0);
    const listed = owned.filter((r) => r.isListed).length;
    const boosts =
      owned.filter((r) => r.isHighlighted).length +
      owned.filter((r) => r.hasGlowBorder).length +
      owned.filter((r) => r.isTrending).length;
    return { regions: owned.length, blocks, listed, boosts };
  }, [owned]);

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(addr);
      toast.success("Address copied");
    } catch {
      toast.error("Couldn't copy");
    }
  };

  const handleOpenRegion = (r: Region) => {
    setSelectedRegion(r);
    navigate("/");
  };

  return (
    <div className="flex flex-col min-h-screen bg-background">
      <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link to="/" className="shrink-0" aria-label="Home">
            <img src={logo} alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-md ring-1 ring-primary/20" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight leading-none truncate">
              <span className="text-primary text-glow">Solana</span>
              <span className="text-foreground">billboard</span>
              <span className="text-muted-foreground hidden sm:inline">.space</span>
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
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10">
          {!valid ? (
            <div className="text-center py-24 text-sm text-muted-foreground">
              <p className="text-foreground text-lg font-semibold mb-2">Invalid address</p>
              <p>The wallet in the URL doesn't look like a Solana address.</p>
              <Link to="/" className="inline-flex items-center gap-1 text-primary hover:underline mt-4 text-sm">
                <ArrowLeft className="w-3.5 h-3.5" /> Back to canvas
              </Link>
            </div>
          ) : (
            <>
              <section className="flex flex-col sm:flex-row items-start sm:items-center gap-4 sm:gap-6 mb-8">
                <div
                  className="w-20 h-20 sm:w-24 sm:h-24 rounded-2xl shrink-0 ring-1 ring-border shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
                  style={{ background: avatarGradient(addr) }}
                  aria-hidden="true"
                />
                <div className="min-w-0 flex-1">
                  {isSelf && (
                    <span className="inline-block text-[10px] uppercase tracking-wider font-semibold text-primary bg-primary/10 border border-primary/30 px-2 py-0.5 rounded-full mb-2">
                      Your profile
                    </span>
                  )}
                  <h2 className="text-2xl sm:text-3xl font-semibold text-foreground leading-tight">
                    {shortAddr(addr)}
                  </h2>
                  <p className="font-mono text-[11px] text-muted-foreground break-all mt-1 sm:mt-2">
                    {addr}
                  </p>
                  <div className="flex items-center gap-2 mt-3">
                    <button
                      type="button"
                      onClick={copyAddress}
                      className="cursor-pointer inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md border border-border hover:border-primary/40 transition-colors"
                    >
                      <Copy className="w-3 h-3" /> Copy
                    </button>
                    <a
                      href={`https://solscan.io/account/${addr}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground px-2.5 py-1 rounded-md border border-border hover:border-primary/40 transition-colors"
                    >
                      <ExternalLink className="w-3 h-3" /> Solscan
                    </a>
                  </div>
                </div>
              </section>

              <section className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
                <StatCard label="Regions" value={stats.regions} loading={isLoading} />
                <StatCard label="Blocks" value={stats.blocks} loading={isLoading} />
                <StatCard label="Listed" value={stats.listed} loading={isLoading} accent />
                <StatCard label="Boosts" value={stats.boosts} loading={isLoading} accent />
              </section>

              <section>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">
                    Regions
                  </h3>
                  <span className="text-xs text-muted-foreground font-mono">
                    {isLoading ? "…" : `${owned.length} total`}
                  </span>
                </div>

                {isLoading ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
                        <Skeleton className="h-28 w-full rounded-none" />
                        <div className="p-3 space-y-2">
                          <Skeleton className="h-3 w-2/3" />
                          <Skeleton className="h-3 w-1/2" />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : owned.length === 0 ? (
                  <div className="text-center py-16 border border-dashed border-border rounded-lg bg-card/30">
                    <p className="text-sm text-muted-foreground">
                      {isSelf
                        ? "You don't own any regions yet."
                        : "This wallet doesn't own any regions."}
                    </p>
                    {isSelf && (
                      <Link
                        to="/"
                        className="inline-flex items-center gap-1.5 text-primary hover:underline mt-3 text-sm font-semibold"
                      >
                        Claim your first region
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {owned.map((r) => (
                      <RegionCard key={r.id} region={r} onOpen={() => handleOpenRegion(r)} />
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
};

interface StatCardProps {
  label: string;
  value: number;
  loading: boolean;
  accent?: boolean;
}

const StatCard = ({ label, value, loading, accent }: StatCardProps) => (
  <div className="bg-card border border-border rounded-lg p-3 sm:p-4">
    <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
    <p
      className={`text-2xl sm:text-3xl font-semibold tabular-nums mt-1 ${
        accent ? "text-accent" : "text-foreground"
      }`}
    >
      {loading ? <Skeleton className="h-8 w-16" /> : value.toLocaleString()}
    </p>
  </div>
);

interface RegionCardProps {
  region: Region;
  onOpen: () => void;
}

const RegionCard = ({ region: r, onOpen }: RegionCardProps) => {
  const currentPrice =
    r.isListed && r.listing
      ? formatSol(
          calculateListingCurrentPrice(
            r.listing.startPrice,
            r.listing.endPrice,
            r.listing.startTime,
            r.listing.endTime
          )
        )
      : null;
  const totalBlocks = r.width * r.height;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="text-left bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
      aria-label={`Region at ${r.startX},${r.startY}, ${r.width} by ${r.height}`}
    >
      <div className="h-28 bg-secondary flex items-center justify-center overflow-hidden relative">
        {r.imageUrl ? (
          <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="text-muted-foreground text-xs font-mono">No image</div>
        )}
        {(r.isHighlighted || r.hasGlowBorder || r.isTrending) && (
          <div className="absolute top-1.5 right-1.5 flex gap-1">
            {r.isHighlighted && <BoostDot color="cyan" icon={<Sparkles className="w-2.5 h-2.5" />} />}
            {r.hasGlowBorder && <BoostDot color="purple" icon={<Zap className="w-2.5 h-2.5" />} />}
            {r.isTrending && <BoostDot color="orange" icon={<TrendingUp className="w-2.5 h-2.5" />} />}
          </div>
        )}
      </div>
      <div className="p-3 space-y-2 text-xs font-mono">
        <div className="flex items-center gap-2">
          <RegionMiniMap
            startX={r.startX}
            startY={r.startY}
            width={r.width}
            height={r.height}
            className="w-16 h-9 rounded border border-border shrink-0"
          />
          <div className="flex-1 min-w-0 space-y-0.5">
            <div className="text-foreground">
              ({r.startX},{r.startY})
            </div>
            <div className="text-primary">
              {r.width}×{r.height} <span className="text-muted-foreground">({totalBlocks})</span>
            </div>
          </div>
        </div>
        <div className="flex justify-between pt-1 border-t border-border">
          <span className="text-muted-foreground">Status</span>
          <span className={r.isListed ? "text-accent inline-flex items-center gap-1" : "text-muted-foreground"}>
            {currentPrice ? (
              <>
                <Tag className="w-3 h-3" /> {currentPrice} SOL
              </>
            ) : (
              "Unlisted"
            )}
          </span>
        </div>
      </div>
    </button>
  );
};

const BoostDot = ({ color, icon }: { color: "cyan" | "purple" | "orange"; icon: React.ReactNode }) => {
  const cls = {
    cyan: "bg-cyan-500/90 text-cyan-50 shadow-[0_0_8px_rgba(41,234,196,0.6)]",
    purple: "bg-purple-500/90 text-purple-50 shadow-[0_0_8px_rgba(153,69,255,0.6)]",
    orange: "bg-orange-500/90 text-orange-50 shadow-[0_0_8px_rgba(255,140,0,0.6)]",
  }[color];
  return (
    <span className={`w-5 h-5 rounded-full inline-flex items-center justify-center ${cls}`} aria-hidden="true">
      {icon}
    </span>
  );
};

export default Profile;
