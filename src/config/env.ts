export type SolanaNetwork = "devnet" | "localnet" | "mainnet-beta";

export interface AppConfig {
  network: SolanaNetwork;
  rpcUrl: string;
  wsUrl: string;
  programId: string;
  usdcMint: string;
  collectionAddress: string;
  treasuryUsdcAta: string;
  pinataJwt: string;
  pinataGateway: string;
}

const DEFAULT_RPC: Record<SolanaNetwork, string> = {
  devnet: "https://api.devnet.solana.com",
  localnet: "http://127.0.0.1:8899",
  "mainnet-beta": "https://api.mainnet-beta.solana.com",
};

const DEFAULT_WS: Record<SolanaNetwork, string> = {
  devnet: "wss://api.devnet.solana.com",
  localnet: "ws://127.0.0.1:8900",
  "mainnet-beta": "wss://api.mainnet-beta.solana.com",
};

function deriveWsUrl(rpcUrl: string): string {
  return rpcUrl.replace("https://", "wss://").replace("http://", "ws://");
}

function getConfig(): AppConfig {
  const network = (import.meta.env.VITE_SOLANA_NETWORK || "devnet") as SolanaNetwork;
  const rpcUrl = import.meta.env.VITE_RPC_URL || DEFAULT_RPC[network];
  return {
    network,
    rpcUrl,
    wsUrl: import.meta.env.VITE_WS_URL || DEFAULT_WS[network] || deriveWsUrl(rpcUrl),
    programId: import.meta.env.VITE_PROGRAM_ID || "DQ1tBHL6cmuUtYAbxvTVvvaNEZtXP1byKeb51gvxWvr2",
    usdcMint: import.meta.env.VITE_USDC_MINT || "",
    collectionAddress: import.meta.env.VITE_COLLECTION_ADDRESS || "",
    treasuryUsdcAta: import.meta.env.VITE_TREASURY_USDC_ATA || "",
    pinataJwt: import.meta.env.VITE_PINATA_JWT || "",
    pinataGateway: import.meta.env.VITE_PINATA_GATEWAY || "",
  };
}

export const config = getConfig();
