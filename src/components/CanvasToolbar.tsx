import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Wallet, LayoutGrid, Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";

interface Props {
  view: "canvas" | "marketplace";
  onViewChange: (v: "canvas" | "marketplace") => void;
}

const CanvasToolbar = ({ view, onViewChange }: Props) => {
  const { connected, publicKey, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  const shortAddress = publicKey
    ? `${publicKey.toBase58().slice(0, 4)}...${publicKey.toBase58().slice(-4)}`
    : "";

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
          <Compass className="w-3.5 h-3.5" />
          Canvas
        </Button>
        <Button
          size="sm"
          variant={view === "marketplace" ? "default" : "ghost"}
          className="gap-1.5 text-xs h-7 px-3"
          onClick={() => onViewChange("marketplace")}
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          Market
        </Button>
      </div>

      <div className="flex items-center gap-2">
        {connected ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => disconnect()}
            className="gap-2 border-primary/30 text-primary text-xs"
          >
            <Wallet className="w-3.5 h-3.5" />
            {shortAddress}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => setVisible(true)}
            className="gap-2 text-xs"
          >
            <Wallet className="w-3.5 h-3.5" />
            Connect
          </Button>
        )}
      </div>
    </header>
  );
};

export default CanvasToolbar;
