import { useRegions } from "@/context/RegionContext";
import { TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { calculateListingCurrentPrice, formatPrice } from "@/solana/pricing";
import type { Region } from "@/types/region";

interface Props {
  onSelectRegion: (region: Region) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const TrendingSidebar = ({ onSelectRegion, collapsed, onToggleCollapse }: Props) => {
  const { trendingRegions } = useRegions();

  if (trendingRegions.length === 0) return null;

  return (
    <div
      className={`bg-card border-r border-border flex flex-col h-full shrink-0 transition-all duration-200 ${
        collapsed ? "w-10" : "w-56"
      }`}
    >
      <div className="flex items-center gap-2 p-2 border-b border-border">
        {!collapsed && (
          <>
            <TrendingUp className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">Trending</h3>
            <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
              {trendingRegions.length}
            </span>
          </>
        )}
        <button
          onClick={onToggleCollapse}
          className={`p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground ${
            collapsed ? "mx-auto" : ""
          }`}
          title={collapsed ? "Show trending" : "Hide trending"}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {trendingRegions.map((r) => (
            <button
              key={r.id}
              onClick={() => onSelectRegion(r)}
              className="w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors"
            >
              <div className="flex items-center gap-2">
                {r.imageUrl ? (
                  <img src={r.imageUrl} alt="" className="w-10 h-10 rounded border border-border object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded border border-border bg-muted flex items-center justify-center">
                    <span className="text-xs text-muted-foreground">?</span>
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-mono text-foreground truncate">
                    {r.owner.slice(0, 4)}...{r.owner.slice(-4)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.width}x{r.height} · ({r.startX},{r.startY})
                  </p>
                  {r.isListed && r.listing && (
                    <p className="text-xs text-accent font-semibold">
                      {formatPrice(
                        calculateListingCurrentPrice(
                          r.listing.startPrice,
                          r.listing.endPrice,
                          r.listing.startTime,
                          r.listing.endTime
                        )
                      )}{" "}
                      SOL
                    </p>
                  )}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default TrendingSidebar;
