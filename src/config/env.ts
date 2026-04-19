export type SolanaNetwork = "devnet" | "localnet" | "mainnet-beta";

export interface AppConfig {
  network: SolanaNetwork;
  rpcUrl: string;
  wsUrl: string;
  programId: string;
  collectionAddress: string;
  treasury: string;
  pinataJwt: string;
  pinataGateway: string;
  /**
   * Use Metaplex DAS API (getAssetsByGroup) instead of raw getProgramAccounts
   * to list Core assets. Requires a DAS-compatible RPC endpoint (Helius,
   * Triton, Shyft). Avoids the slow full-program scan that mainnet gPA hits.
   */
  useDAS: boolean;
}

const VALID_NETWORKS: SolanaNetwork[] = ["devnet", "localnet", "mainnet-beta"];

function requireVar(name: string, value: string | undefined): string {
  const v = (value ?? "").trim();
  if (!v) {
    throw new Error(
      `Config error: ${name} is required (no fallback). Check your .env file.`
    );
  }
  return v;
}

function deriveWsUrl(rpcUrl: string): string {
  return rpcUrl.replace(/^https:\/\//, "wss://").replace(/^http:\/\//, "ws://");
}

function getConfig(): AppConfig {
  const network = requireVar("VITE_SOLANA_NETWORK", import.meta.env.VITE_SOLANA_NETWORK) as SolanaNetwork;
  if (!VALID_NETWORKS.includes(network)) {
    throw new Error(
      `Config error: VITE_SOLANA_NETWORK="${network}" is invalid. Must be one of: ${VALID_NETWORKS.join(", ")}.`
    );
  }

  const rpcUrl = requireVar("VITE_RPC_URL", import.meta.env.VITE_RPC_URL);
  const programId = requireVar("VITE_PROGRAM_ID", import.meta.env.VITE_PROGRAM_ID);
  const collectionAddress = requireVar("VITE_COLLECTION_ADDRESS", import.meta.env.VITE_COLLECTION_ADDRESS);
  const treasury = requireVar("VITE_TREASURY", import.meta.env.VITE_TREASURY);
  const pinataJwt = requireVar("VITE_PINATA_JWT", import.meta.env.VITE_PINATA_JWT);
  const pinataGateway = requireVar("VITE_PINATA_GATEWAY", import.meta.env.VITE_PINATA_GATEWAY);

  const wsUrl = (import.meta.env.VITE_WS_URL ?? "").trim() || deriveWsUrl(rpcUrl);

  return {
    network,
    rpcUrl,
    wsUrl,
    programId,
    collectionAddress,
    treasury,
    pinataJwt,
    pinataGateway,
    useDAS: import.meta.env.VITE_USE_DAS === "true",
  };
}

export const config = getConfig();
