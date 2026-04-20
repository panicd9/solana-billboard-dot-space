import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, RefreshCw, Activity as ActivityIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import WalletButton from "@/components/WalletButton";
import WalletBalances from "@/components/WalletBalances";
import ActivityRow from "@/components/ActivityRow";
import SiteFooter from "@/components/SiteFooter";
import logo from "@/assets/logo.png";
import { useActivityEvents } from "@/hooks/useActivityEvents";
import { useRegions } from "@/context/RegionContext";
import { ACTIVITY_FILTER_TYPES } from "@/solana/activityEvents";

const INITIAL_VISIBLE = 50;
const PAGE_SIZE = 50;

const Activity = () => {
  const { data: events, isLoading, isFetching, error, refetch } = useActivityEvents();
  const { regions } = useRegions();
  const [filterKey, setFilterKey] = useState<string>("all");
  const [visible, setVisible] = useState(INITIAL_VISIBLE);

  // Quick asset → region lookup for mini-map thumbnails.
  const regionByAsset = useMemo(() => {
    const m = new Map<string, typeof regions[number]>();
    for (const r of regions) m.set(r.id, r);
    return m;
  }, [regions]);

  const filter = ACTIVITY_FILTER_TYPES.find((f) => f.key === filterKey) ?? ACTIVITY_FILTER_TYPES[0];
  const filtered = useMemo(() => {
    if (!events) return [];
    return events.filter((e) => filter.matches(e.type));
  }, [events, filter]);

  const shown = filtered.slice(0, visible);
  const hasMore = filtered.length > visible;

  return (
    <div className="flex flex-col h-screen bg-background overflow-hidden">
      <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
          <Link to="/" aria-label="Back to canvas" className="shrink-0">
            <img src={logo} alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-md ring-1 ring-primary/20" />
          </Link>
          <div className="min-w-0">
            <h1 className="text-base sm:text-lg font-semibold tracking-tight leading-none truncate">
              <ActivityIcon className="inline w-4 h-4 text-primary mr-1.5 -mt-0.5" aria-hidden="true" />
              <span className="text-foreground">Activity</span>
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
        <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div role="tablist" aria-label="Filter events" className="flex items-center gap-1 flex-wrap">
              {ACTIVITY_FILTER_TYPES.map((f) => {
                const selected = f.key === filterKey;
                return (
                  <button
                    key={f.key}
                    role="tab"
                    aria-selected={selected}
                    onClick={() => {
                      setFilterKey(f.key);
                      setVisible(INITIAL_VISIBLE);
                    }}
                    className={`cursor-pointer text-xs px-3 py-1 rounded-full border transition-colors ${
                      selected
                        ? "bg-primary/15 border-primary/40 text-primary"
                        : "bg-secondary border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => refetch()}
              disabled={isFetching}
              aria-label="Refresh activity"
              className="cursor-pointer h-7 gap-1.5 text-xs shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin" : ""}`} aria-hidden="true" />
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>

          {isLoading ? (
            <ul className="space-y-2" aria-busy="true" aria-label="Loading activity">
              {Array.from({ length: 6 }).map((_, i) => (
                <li key={i}>
                  <Skeleton className="h-[62px] w-full rounded-lg" />
                </li>
              ))}
            </ul>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-foreground font-semibold mb-1">Couldn't load activity</p>
              <p className="text-sm text-muted-foreground mb-4">
                {(error as Error).message || "The RPC request failed."}
              </p>
              <Button variant="outline" size="sm" onClick={() => refetch()} className="cursor-pointer">
                Retry
              </Button>
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <ActivityIcon className="w-10 h-10 mx-auto mb-3 opacity-40" aria-hidden="true" />
              <p className="text-foreground font-semibold mb-1">No activity yet</p>
              <p className="text-sm">Recent on-chain events will appear here.</p>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {shown.map((event) => (
                  <li key={event.signature + event.type + (event.assetAddress ?? "")}>
                    <ActivityRow
                      event={event}
                      region={event.assetAddress ? regionByAsset.get(event.assetAddress) ?? null : null}
                    />
                  </li>
                ))}
              </ul>
              {hasMore && (
                <div className="pt-4 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setVisible((v) => v + PAGE_SIZE)}
                    className="cursor-pointer"
                  >
                    Load more
                  </Button>
                </div>
              )}
              <p className="text-[11px] text-muted-foreground text-center mt-4">
                Showing {shown.length} of {filtered.length} events · Last {INITIAL_VISIBLE * 2} on-chain signatures
              </p>
            </>
          )}
        </div>
      </main>
      <SiteFooter />
    </div>
  );
};

export default Activity;
