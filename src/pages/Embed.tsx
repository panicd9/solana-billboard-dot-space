import { useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { ExternalLink, Tag, Sparkles, Zap, TrendingUp } from "lucide-react";
import RegionMiniMap from "@/components/RegionMiniMap";
import { useRegions } from "@/context/RegionContext";
import { calculateListingCurrentPrice, formatUsdc } from "@/solana/pricing";
import logo from "@/assets/logo.png";

const Embed = () => {
  const { assetId } = useParams<{ assetId: string }>();
  const { regions, isLoading } = useRegions();

  const region = useMemo(
    () => regions.find((r) => r.id === assetId),
    [regions, assetId]
  );

  // Set a transparent-ish body bg so the embed blends if host overrides.
  useEffect(() => {
    document.body.classList.add("embed-body");
    return () => document.body.classList.remove("embed-body");
  }, []);

  const currentPrice =
    region?.isListed && region.listing
      ? formatUsdc(
          calculateListingCurrentPrice(
            region.listing.startPrice,
            region.listing.endPrice,
            region.listing.startTime,
            region.listing.endTime
          )
        )
      : null;

  const siteUrl = "https://billboard.space";
  const regionUrl = assetId ? `${siteUrl}/?region=${assetId}` : siteUrl;

  return (
    <div className="h-screen w-screen bg-background text-foreground overflow-hidden flex items-stretch">
      {isLoading && !region ? (
        <div className="flex-1 flex items-center justify-center text-xs text-muted-foreground font-mono">
          Loading…
        </div>
      ) : !region ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-xs text-muted-foreground font-mono">Region not found</p>
          <a
            href={siteUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-primary hover:underline"
          >
            <ExternalLink className="w-3 h-3" /> billboard.space
          </a>
        </div>
      ) : (
        <a
          href={regionUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-1 flex flex-col bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-colors group"
        >
          <div className="flex-1 bg-secondary flex items-center justify-center overflow-hidden relative min-h-0">
            {region.imageUrl ? (
              <img
                src={region.imageUrl}
                alt=""
                className="w-full h-full object-cover"
                loading="eager"
              />
            ) : (
              <div className="text-muted-foreground text-xs font-mono">No image</div>
            )}
            {(region.isHighlighted || region.hasGlowBorder || region.isTrending) && (
              <div className="absolute top-1.5 right-1.5 flex gap-1">
                {region.isHighlighted && (
                  <BoostDot color="cyan" icon={<Sparkles className="w-2.5 h-2.5" />} />
                )}
                {region.hasGlowBorder && (
                  <BoostDot color="purple" icon={<Zap className="w-2.5 h-2.5" />} />
                )}
                {region.isTrending && (
                  <BoostDot color="orange" icon={<TrendingUp className="w-2.5 h-2.5" />} />
                )}
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-border bg-card/90 backdrop-blur-sm px-3 py-2 flex items-center gap-2.5">
            <RegionMiniMap
              startX={region.startX}
              startY={region.startY}
              width={region.width}
              height={region.height}
              className="w-12 h-7 rounded border border-border shrink-0"
            />
            <div className="flex-1 min-w-0 text-[11px] font-mono leading-tight">
              <div className="text-foreground">
                ({region.startX},{region.startY}) · {region.width}×{region.height}
              </div>
              <div className={currentPrice ? "text-accent" : "text-muted-foreground"}>
                {currentPrice ? (
                  <span className="inline-flex items-center gap-1">
                    <Tag className="w-2.5 h-2.5" /> {currentPrice} USDC
                  </span>
                ) : (
                  "Unlisted"
                )}
              </div>
            </div>
            <div className="shrink-0 flex items-center gap-1.5">
              <img src={logo} alt="" className="w-4 h-4 rounded-sm" />
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider group-hover:text-primary transition-colors">
                billboard.space
              </span>
            </div>
          </div>
        </a>
      )}
    </div>
  );
};

const BoostDot = ({
  color,
  icon,
}: {
  color: "cyan" | "purple" | "orange";
  icon: React.ReactNode;
}) => {
  const cls = {
    cyan: "bg-cyan-500/90 text-cyan-50 shadow-[0_0_8px_rgba(41,234,196,0.6)]",
    purple: "bg-purple-500/90 text-purple-50 shadow-[0_0_8px_rgba(153,69,255,0.6)]",
    orange: "bg-orange-500/90 text-orange-50 shadow-[0_0_8px_rgba(255,140,0,0.6)]",
  }[color];
  return (
    <span
      className={`w-5 h-5 rounded-full inline-flex items-center justify-center ${cls}`}
      aria-hidden="true"
    >
      {icon}
    </span>
  );
};

export default Embed;
