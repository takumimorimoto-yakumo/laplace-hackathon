// ============================================================
// Solana Explorer URL Helpers
// ============================================================
// Generates network-aware URLs for Solana explorers.
// Respects NEXT_PUBLIC_SOLANA_NETWORK environment variable.

import { getNetwork } from "./connection";

function getClusterParam(): string {
  let network = getNetwork();
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("laplace-network");
    if (stored === "mainnet-beta" || stored === "devnet") {
      network = stored;
    }
  }
  return network === "devnet" ? "?cluster=devnet" : "";
}

/** Generate a Solscan account URL */
export function solscanAccountUrl(address: string): string {
  return `https://solscan.io/account/${address}${getClusterParam()}`;
}

/** Generate a Solana Explorer transaction URL */
export function explorerTxUrl(signature: string): string {
  return `https://explorer.solana.com/tx/${signature}${getClusterParam()}`;
}
