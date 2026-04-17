import { Grid, Tag, Activity as ActivityIcon } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import WalletButton from "@/components/WalletButton";
import WalletBalances from "@/components/WalletBalances";
import logo from "@/assets/logo.png";
import { useRegions } from "@/context/RegionContext";

interface Props {
  view: "canvas" | "marketplace";
  onViewChange: (v: "canvas" | "marketplace") => void;
}

const CanvasToolbar = ({ view, onViewChange }: Props) => {
  const { isLoading, regions } = useRegions();
  return (
    <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
        <img src={logo} alt="" className="w-9 h-9 sm:w-10 sm:h-10 rounded-md shrink-0 ring-1 ring-primary/20" />
        <div className="min-w-0">
          <h1 className="text-base sm:text-lg font-semibold tracking-tight leading-none truncate">
            <span className="text-primary text-glow">Solana</span>
            <span className="text-foreground">billboard</span>
            <span className="text-muted-foreground hidden sm:inline">.space</span>
          </h1>
          <p className="hidden sm:block text-[10px] text-muted-foreground tracking-wider uppercase mt-1">
            Own pixels on Solana
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div
          aria-live="polite"
          className={`hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border transition-all ${
            isLoading
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted/40 border-border text-muted-foreground"
          }`}
        >
          <span className="relative flex w-1.5 h-1.5">
            {isLoading && (
              <span className="absolute inset-0 rounded-full bg-primary opacity-75 animate-ping" />
            )}
            <span
              className={`relative inline-block w-1.5 h-1.5 rounded-full ${
                isLoading ? "bg-primary" : "bg-emerald-400"
              }`}
            />
          </span>
          {isLoading ? "Syncing…" : `${regions.length} region${regions.length === 1 ? "" : "s"}`}
        </div>

        <div role="tablist" aria-label="View" className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
        <Button
          role="tab"
          aria-selected={view === "canvas"}
          size="sm"
          variant={view === "canvas" ? "default" : "ghost"}
          className="cursor-pointer gap-1.5 text-xs h-7 px-3"
          onClick={() => onViewChange("canvas")}
        >
          <Grid className="w-3.5 h-3.5" aria-hidden="true" />
          Billboard
        </Button>
        <Button
          role="tab"
          aria-selected={view === "marketplace"}
          size="sm"
          variant={view === "marketplace" ? "default" : "ghost"}
          className="cursor-pointer gap-1.5 text-xs h-7 px-3"
          onClick={() => onViewChange("marketplace")}
        >
          <Tag className="w-3.5 h-3.5" aria-hidden="true" />
          Market
        </Button>
        </div>

        <Button
          asChild
          size="sm"
          variant="ghost"
          className="cursor-pointer gap-1.5 text-xs h-7 px-3 text-muted-foreground hover:text-foreground"
        >
          <Link to="/activity" aria-label="View recent activity">
            <ActivityIcon className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline">Activity</span>
          </Link>
        </Button>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        <div className="hidden md:block">
          <WalletBalances />
        </div>
        <WalletButton />
      </div>
    </header>
  );
};

export default CanvasToolbar;
