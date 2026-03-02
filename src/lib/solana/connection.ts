import { Connection, clusterApiUrl } from "@solana/web3.js";

type SolanaNetwork = "devnet" | "mainnet-beta";

let connectionInstance: Connection | null = null;

export function getConnection(): Connection {
  if (connectionInstance) return connectionInstance;

  const rpcUrl = process.env.SOLANA_RPC_URL
    ?? process.env.NEXT_PUBLIC_SOLANA_RPC_URL
    ?? clusterApiUrl(getNetwork());

  connectionInstance = new Connection(rpcUrl, "confirmed");
  return connectionInstance;
}

export function getNetwork(): SolanaNetwork {
  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (network === "mainnet-beta") return "mainnet-beta";
  return "devnet";
}
