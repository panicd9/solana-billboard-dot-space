import { FC, ReactNode, useMemo } from "react";
import { SolanaProvider as BaseSolanaProvider } from "@solana/react-hooks";
import { createClient, autoDiscover } from "@solana/client";
import { config } from "@/config/env";

interface Props {
  children: ReactNode;
}

const SolanaProvider: FC<Props> = ({ children }) => {
  const client = useMemo(
    () =>
      createClient({
        endpoint: config.rpcUrl,
        websocketEndpoint: config.wsUrl,
        walletConnectors: autoDiscover(),
      }),
    []
  );

  return (
    <BaseSolanaProvider client={client} walletPersistence={{ autoConnect: true }}>
      {children}
    </BaseSolanaProvider>
  );
};

export default SolanaProvider;
