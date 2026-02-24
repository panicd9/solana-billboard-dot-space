import { useState, useMemo } from "react";
import { ArrowUpDown, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useRegions } from "@/context/RegionContext";

interface Props {
  onHighlightRegion: (regionId: string) => void;
}

type SortKey = "price" | "size" | "recent";

const MarketplaceView = ({ onHighlightRegion }: Props) => {
  const { regions, setSelectedRegion } = useRegions();
  const [sortBy, setSortBy] = useState<SortKey>("recent");

  const sorted = useMemo(() => {
    const copy = [...regions];
    switch (sortBy) {
      case "price":
        return copy.sort((a, b) => a.purchasePrice - b.purchasePrice);
      case "size":
        return copy.sort((a, b) => b.width * b.height - a.width * a.height);
      case "recent":
      default:
        return copy.sort((a, b) => b.createdAt - a.createdAt);
    }
  }, [regions, sortBy]);

  return (
    <div className="flex-1 overflow-auto bg-background p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-semibold text-foreground">Marketplace</h2>
          <div className="flex items-center gap-2">
            <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
            {(["recent", "price", "size"] as SortKey[]).map((key) => (
              <Button
                key={key}
                size="sm"
                variant={sortBy === key ? "default" : "ghost"}
                className="text-xs capitalize"
                onClick={() => setSortBy(key)}
              >
                {key}
              </Button>
            ))}
          </div>
        </div>

        {sorted.length === 0 ? (
          <div className="text-center text-muted-foreground py-20 text-sm">
            No regions purchased yet. Select blocks on the canvas to get started.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((r) => (
              <div
                key={r.id}
                className="bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-colors cursor-pointer group"
                onClick={() => {
                  setSelectedRegion(r);
                  onHighlightRegion(r.id);
                }}
              >
                {/* Thumbnail */}
                <div className="h-28 bg-secondary flex items-center justify-center overflow-hidden">
                  {r.imageUrl ? (
                    <img src={r.imageUrl} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <div className="text-muted-foreground text-xs font-mono">No image</div>
                  )}
                </div>
                <div className="p-3 space-y-1.5 text-xs font-mono">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Owner</span>
                    <span className="text-foreground">{r.owner.slice(0, 4)}...{r.owner.slice(-4)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Position</span>
                    <span className="text-foreground flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      ({r.startX},{r.startY})
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Size</span>
                    <span className="text-primary">{r.width}×{r.height} ({r.width * r.height})</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Price</span>
                    <span className="text-accent">{r.purchasePrice.toFixed(4)} SOL</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Status</span>
                    <span className={r.isListed ? "text-accent" : "text-muted-foreground"}>
                      {r.isListed ? `Listed @ ${r.listingPrice} SOL` : "Unlisted"}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceView;
