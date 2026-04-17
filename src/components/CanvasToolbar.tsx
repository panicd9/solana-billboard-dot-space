import { Grid, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import WalletButton from "@/components/WalletButton";
import WalletBalances from "@/components/WalletBalances";
import logo from "@/assets/logo.png";

interface Props {
  view: "canvas" | "marketplace";
  onViewChange: (v: "canvas" | "marketplace") => void;
}

const CanvasToolbar = ({ view, onViewChange }: Props) => {
  return (
    <header className="flex items-center justify-between gap-2 px-3 sm:px-5 py-2.5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
        <img src={logo} alt="" className="w-8 h-8 rounded shrink-0" />
        <h1 className="text-base font-semibold tracking-tight truncate">
          <span className="text-primary text-glow">Solana</span>
          <span className="text-foreground">billboard</span>
          <span className="text-muted-foreground hidden sm:inline">.space</span>
        </h1>
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

      <div className="flex items-center gap-3 min-w-0">
        <div className="hidden md:block">
          <WalletBalances />
        </div>
        <WalletButton />
      </div>
    </header>
  );
};

export default CanvasToolbar;
