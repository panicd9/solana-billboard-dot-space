import { useBalance, useWalletConnection } from "@solana/react-hooks";
import { formatSol } from "@/solana/pricing";

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
    </div>
  );
};

export default WalletBalances;
