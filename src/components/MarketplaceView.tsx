import { useState, useMemo } from "react";
import { ArrowUpDown, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useRegions } from "@/context/RegionContext";
import { calculateListingCurrentPrice, formatUsdc } from "@/solana/pricing";

interface Props {
  onHighlightRegion: (regionId: string) => void;
}

type SortKey = "price" | "size" | "recent";
type FilterKey = "all" | "listed" | "unlisted";

const MarketplaceView = ({ onHighlightRegion }: Props) => {
  const { regions, setSelectedRegion, isLoading } = useRegions();
  const [sortBy, setSortBy] = useState<SortKey>("recent");
  const [filterBy, setFilterBy] = useState<FilterKey>("all");
  const [search, setSearch] = useState("");

  const sorted = useMemo(() => {
    const q = search.trim().toLowerCase();
    let filtered = regions;
    if (filterBy === "listed") filtered = filtered.filter((r) => r.isListed);
    else if (filterBy === "unlisted") filtered = filtered.filter((r) => !r.isListed);
    if (q) {
      filtered = filtered.filter((r) =>
        r.owner.toLowerCase().includes(q) || r.linkUrl?.toLowerCase().includes(q)
      );
    }
    const copy = [...filtered];
    switch (sortBy) {
      case "price":
        return copy.sort((a, b) => a.purchasePrice - b.purchasePrice);
      case "size":
        return copy.sort((a, b) => b.width * b.height - a.width * a.height);
      case "recent":
      default:
        return copy.sort((a, b) => b.createdAt - a.createdAt);
    }
  }, [regions, sortBy, filterBy, search]);

  return (
    <div className="flex-1 overflow-auto bg-background p-4 sm:p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex flex-col gap-3 mb-6">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h2 className="text-lg font-semibold text-foreground">Marketplace</h2>
            <div className="flex items-center gap-2 flex-wrap">
              <ArrowUpDown className="w-4 h-4 text-muted-foreground" aria-hidden="true" />
              {(["recent", "price", "size"] as SortKey[]).map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={sortBy === key ? "default" : "ghost"}
                  className="cursor-pointer text-xs capitalize"
                  aria-pressed={sortBy === key}
                  onClick={() => setSortBy(key)}
                >
                  {key}
                </Button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <label htmlFor="marketplace-search" className="sr-only">
                Search by owner or link
              </label>
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="marketplace-search"
                type="search"
                placeholder="Search owner or link..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-card border border-border rounded-md pl-8 pr-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <div role="group" aria-label="Filter listings" className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
              {(["all", "listed", "unlisted"] as FilterKey[]).map((key) => (
                <Button
                  key={key}
                  size="sm"
                  variant={filterBy === key ? "default" : "ghost"}
                  className="cursor-pointer text-xs capitalize h-7 px-3"
                  aria-pressed={filterBy === key}
                  onClick={() => setFilterBy(key)}
                >
                  {key}
                </Button>
              ))}
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="bg-card border border-border rounded-lg overflow-hidden">
                <Skeleton className="h-28 w-full rounded-none" />
                <div className="p-3 space-y-2">
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        ) : sorted.length === 0 ? (
          <div className="text-center text-muted-foreground py-20 text-sm">
            {regions.length === 0
              ? "No regions purchased yet. Select blocks on the canvas to get started."
              : "No regions match your search."}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((r) => {
              const currentPrice =
                r.isListed && r.listing
                  ? formatUsdc(
                      calculateListingCurrentPrice(
                        r.listing.startPrice,
                        r.listing.endPrice,
                        r.listing.startTime,
                        r.listing.endTime
                      )
                    )
                  : null;

              return (
                <button
                  key={r.id}
                  type="button"
                  className="text-left bg-card border border-border rounded-lg overflow-hidden hover:border-primary/40 transition-colors cursor-pointer group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  onClick={() => {
                    setSelectedRegion(r);
                    onHighlightRegion(r.id);
                  }}
                  aria-label={`Region at ${r.startX},${r.startY}, ${r.width} by ${r.height}, ${currentPrice ? `listed at ${currentPrice} USDC` : "not listed"}`}
                >
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
                      <span className="text-foreground">
                        {r.owner.slice(0, 4)}...{r.owner.slice(-4)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Position</span>
                      <span className="text-foreground flex items-center gap-1">
                        <MapPin className="w-3 h-3" aria-hidden="true" />({r.startX},{r.startY})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Size</span>
                      <span className="text-primary">
                        {r.width}x{r.height} ({r.width * r.height})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status</span>
                      <span className={r.isListed ? "text-accent" : "text-muted-foreground"}>
                        {currentPrice ? `Listed @ ${currentPrice} USDC` : "Unlisted"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default MarketplaceView;
