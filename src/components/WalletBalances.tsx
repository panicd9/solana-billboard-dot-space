import { useBalance, useWalletConnection } from "@solana/react-hooks";
import { HelpCircle } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { config } from "@/config/env";

const isDevnet = config.network === "devnet" || config.network === "localnet";

const LAMPORTS_PER_SOL = 1_000_000_000n;

function formatSol(lamports: bigint | null): string {
  if (lamports === null) return "—";
  const whole = lamports / LAMPORTS_PER_SOL;
  const frac = lamports % LAMPORTS_PER_SOL;
  const decimals = frac.toString().padStart(9, "0").slice(0, 2);
  return `${whole}.${decimals}`;
}

const WalletBalances = () => {
  const { connected, wallet } = useWalletConnection();
  const address = connected && wallet ? wallet.account.address : undefined;

  const { lamports } = useBalance(address);

  if (!connected) return null;

  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      <span className="text-muted-foreground">
        <span className="text-primary font-semibold">{formatSol(lamports)}</span>{" "}
        SOL
      </span>
      {isDevnet && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-muted-foreground hover:text-primary transition-colors" aria-label="Devnet faucet links">
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
