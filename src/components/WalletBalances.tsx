import { useBalance, useWalletConnection } from "@solana/react-hooks";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { config } from "@/config/env";
import { formatSol } from "@/solana/pricing";

const isDevnet = config.network === "devnet" || config.network === "localnet";

const WalletBalances = () => {
  const { connected, wallet } = useWalletConnection();
  const address = connected && wallet ? wallet.account.address : undefined;

  const { lamports } = useBalance(address);

  if (!connected) return null;

  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      <span className="text-muted-foreground">
        <span className="text-primary font-semibold">
          {lamports === null ? "—" : formatSol(lamports)}
        </span>{" "}
        SOL
      </span>
      {isDevnet && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground hover:text-primary transition-colors" aria-label="Devnet faucet link">
              <HelpCircle className="h-3.5 w-3.5" />
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-3 text-xs" side="bottom" align="end">
            <p className="font-semibold text-foreground mb-2">Devnet Faucet</p>
            <ul className="space-y-1.5">
              <li>
                <a href="https://faucet.solana.com/" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                  Get SOL →
                </a>
              </li>
            </ul>
          </PopoverContent>
        </Popover>
      )}
    </div>
  );
};

export default WalletBalances;
