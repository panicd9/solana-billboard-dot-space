import { LayoutGrid, Compass, Grid, Monitor, Layers, DollarSign, ShoppingCart, Store, Tag } from "lucide-react";
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
    <header className="flex items-center justify-between px-5 py-2.5 border-b border-border bg-card/80 backdrop-blur-sm shrink-0">
      <div className="flex items-center gap-4">
        <img src={logo} alt="Solanabillboard.space" className="w-8 h-8 rounded" />
        <h1 className="text-base font-semibold tracking-tight">
          <span className="text-primary text-glow">Solana</span>
          <span className="text-foreground">billboard</span>
          <span className="text-muted-foreground">.space</span>
        </h1>
      </div>

      <div className="flex items-center gap-1 bg-secondary rounded-md p-0.5">
        <Button
          size="sm"
          variant={view === "canvas" ? "default" : "ghost"}
          className="gap-1.5 text-xs h-7 px-3"
          onClick={() => onViewChange("canvas")}
        >
          <Grid className="w-3.5 h-3.5" />
          Billboard
        </Button>
        <Button
          size="sm"
          variant={view === "marketplace" ? "default" : "ghost"}
          className="gap-1.5 text-xs h-7 px-3"
          onClick={() => onViewChange("marketplace")}
        >
          <Tag className="w-3.5 h-3.5" />
          Market
        </Button>
      </div>

      <div className="flex items-center gap-3">
        <WalletBalances />
        <WalletButton />
      </div>
    </header>
  );
};

export default CanvasToolbar;
