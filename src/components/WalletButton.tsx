import { Wallet, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useWalletConnection } from "@solana/react-hooks";

const WalletButton = () => {
  const { connected, connecting, connectors, connect, disconnect, wallet, isReady } =
    useWalletConnection();

  if (!isReady) {
    return (
      <Button size="sm" variant="outline" disabled className="gap-2 text-xs">
        <Wallet className="w-3.5 h-3.5" />
        Loading...
      </Button>
    );
  }

  if (connected && wallet) {
    const address = wallet.account.address;
    const shortAddress = `${address.slice(0, 4)}...${address.slice(-4)}`;

    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="gap-2 border-primary/30 text-primary text-xs"
          >
            <Wallet className="w-3.5 h-3.5" />
            {shortAddress}
            <ChevronDown className="w-3 h-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="text-xs font-mono" disabled>
            {address.slice(0, 20)}...
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => disconnect()} className="gap-2 text-xs">
            <LogOut className="w-3.5 h-3.5" />
            Disconnect
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  if (connectors.length === 0) {
    return (
      <Button size="sm" className="gap-2 text-xs" disabled>
        <Wallet className="w-3.5 h-3.5" />
        No Wallets
      </Button>
    );
  }

  if (connectors.length === 1) {
    return (
      <Button
        size="sm"
        className="gap-2 text-xs"
        onClick={() => connect(connectors[0].id)}
        disabled={connecting}
      >
        <Wallet className="w-3.5 h-3.5" />
        {connecting ? "Connecting..." : "Connect"}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-2 text-xs" disabled={connecting}>
          <Wallet className="w-3.5 h-3.5" />
          {connecting ? "Connecting..." : "Connect"}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {connectors.map((c) => (
          <DropdownMenuItem
            key={c.id}
            onClick={() => connect(c.id)}
            className="gap-2 text-xs"
          >
            {c.icon && (
              <img src={c.icon} alt="" className="w-4 h-4 rounded" />
            )}
            {c.name}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default WalletButton;
