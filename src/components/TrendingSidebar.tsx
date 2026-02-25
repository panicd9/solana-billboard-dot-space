import { useRegions } from "@/context/RegionContext";
import { TrendingUp } from "lucide-react";

interface Props {
  onSelectRegion: (regionId: string) => void;
}

const TrendingSidebar = ({ onSelectRegion }: Props) => {
  const { trendingRegions } = useRegions();

  if (trendingRegions.length === 0) return null;

  return (
    <div className="w-56 bg-card border-r border-border flex flex-col h-full overflow-y-auto shrink-0">
      <div className="flex items-center gap-2 p-3 border-b border-border">
        <TrendingUp className="w-4 h-4 text-orange-400" />
        <h3 className="text-sm font-semibold text-foreground">Trending</h3>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {trendingRegions.length}
        </span>
      </div>
      <div className="flex-1 overflow-y-auto">
        {trendingRegions.map((r) => (
          <button
            key={r.id}
            onClick={() => onSelectRegion(r.id)}
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
                  {r.width}×{r.height} · ({r.startX},{r.startY})
                </p>
                {r.isListed && (
                  <p className="text-xs text-accent font-semibold">{r.listingPrice} SOL</p>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

export default TrendingSidebar;
