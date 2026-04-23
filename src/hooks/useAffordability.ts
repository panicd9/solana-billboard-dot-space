import { useMemo } from "react";
import { useBalance, useWalletConnection } from "@solana/react-hooks";

// Flat buffer reserved on top of the purchase price so a "can afford" check
// still leaves room for the tx base fee, priority fee, and any new account
// rent the instruction creates (mint creates a Boosts PDA, listing creates a
// Listing PDA, etc.). 0.002 SOL is generous but invisible at current prices.
export const TX_FEE_BUFFER_LAMPORTS = 2_000_000n;

export type Affordability =
  | { kind: "disconnected" }
  | { kind: "loading" }
  | { kind: "ok" }
  | { kind: "short"; shortfall: bigint };

export function computeAffordability(
  balance: bigint | null | undefined,
  priceLamports: bigint | null | undefined,
  feeBuffer: bigint,
  connected: boolean,
): Affordability {
  if (!connected) return { kind: "disconnected" };
  if (balance === null || balance === undefined) return { kind: "loading" };
  if (priceLamports === null || priceLamports === undefined) return { kind: "loading" };
  const needed = priceLamports + feeBuffer;
  if (balance >= needed) return { kind: "ok" };
  return { kind: "short", shortfall: needed - balance };
}

export function useLamportBalance(): { lamports: bigint | null; connected: boolean } {
  const { connected, wallet } = useWalletConnection();
  const address = connected && wallet ? wallet.account.address : undefined;
  const { lamports } = useBalance(address);
  return { lamports: lamports ?? null, connected };
}

export function useAffordability(
  priceLamports: bigint | null | undefined,
  feeBuffer: bigint = TX_FEE_BUFFER_LAMPORTS,
): Affordability {
  const { lamports, connected } = useLamportBalance();
  return useMemo(
    () => computeAffordability(lamports, priceLamports, feeBuffer, connected),
    [connected, lamports, priceLamports, feeBuffer],
  );
}
