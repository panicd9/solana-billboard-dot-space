import { useBalance, useSplToken, useWalletConnection } from "@solana/react-hooks";
import { config } from "@/config/env";

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
  const { balance: usdcBalance, status: usdcStatus } = useSplToken(
    config.usdcMint || undefined
  );

  if (!connected) return null;

  const usdcAmount =
    usdcStatus === "ready" && usdcBalance
      ? usdcBalance.uiAmount ?? "0.00"
      : "—";

  return (
    <div className="flex items-center gap-3 text-xs font-mono">
      <span className="text-muted-foreground">
        <span className="text-primary font-semibold">{formatSol(lamports)}</span>{" "}
        SOL
      </span>
      {config.usdcMint && (
        <span className="text-muted-foreground">
          <span className="text-[#2775CA] font-semibold">{usdcAmount}</span>{" "}
          USDC
        </span>
      )}
    </div>
  );
};

export default WalletBalances;
