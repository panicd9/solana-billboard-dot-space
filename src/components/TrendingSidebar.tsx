import { useRegions } from "@/context/RegionContext";
import { TrendingUp, ChevronLeft, ChevronRight } from "lucide-react";
import { ListingStatus } from "@/components/ListingStatus";
import {
  boostSecondsRemaining,
  formatBoostCountdown,
  effectiveOwner,
  type Region,
} from "@/types/region";
import { BOOST_META } from "@/lib/boosts";
import { useNowSeconds } from "@/hooks/useNow";

interface Props {
  onSelectRegion: (region: Region) => void;
  collapsed: boolean;
  onToggleCollapse: () => void;
}

const TrendingSidebar = ({ onSelectRegion, collapsed, onToggleCollapse }: Props) => {
  const { trendingRegions } = useRegions();
  const nowSec = useNowSeconds(1000);

  if (trendingRegions.length === 0) return null;

  return (
    <aside
      aria-label="Trending regions"
      className={`hidden md:flex bg-card border-r border-border flex-col h-full shrink-0 transition-all duration-200 ${
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
          type="button"
          onClick={onToggleCollapse}
          className={`cursor-pointer p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
            collapsed ? "mx-auto" : ""
          }`}
          aria-label={collapsed ? "Show trending" : "Hide trending"}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronRight className="w-4 h-4" aria-hidden="true" /> : <ChevronLeft className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>
      {!collapsed && (
        <div className="flex-1 overflow-y-auto">
          {trendingRegions.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => onSelectRegion(r)}
              className="cursor-pointer w-full text-left p-3 border-b border-border hover:bg-muted/50 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset"
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
                    {(() => {
                      const o = effectiveOwner(r);
                      return `${o.slice(0, 4)}...${o.slice(-4)}`;
                    })()}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {r.width}x{r.height} · ({r.startX},{r.startY})
                  </p>
                  {r.isListed && r.listing && (
                    <ListingStatus
                      listing={r.listing}
                      isListed={r.isListed}
                      className="text-xs font-semibold"
                    />
                  )}
                  <p className={`text-[10px] font-mono ${BOOST_META.trending.iconClass}`}>
                    {formatBoostCountdown(boostSecondsRemaining(r.trendingAt, nowSec))}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </aside>
  );
};

export default TrendingSidebar;
