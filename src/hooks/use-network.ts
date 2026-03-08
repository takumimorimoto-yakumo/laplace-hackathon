"use client";

import { useState, useCallback } from "react";

type SolanaNetwork = "devnet" | "mainnet-beta";

const STORAGE_KEY = "laplace-network";

function getStoredNetwork(): SolanaNetwork {
  if (typeof window === "undefined") return getEnvNetwork();
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "mainnet-beta" || stored === "devnet") return stored;
  return getEnvNetwork();
}

function getEnvNetwork(): SolanaNetwork {
  return process.env.NEXT_PUBLIC_SOLANA_NETWORK === "mainnet-beta"
    ? "mainnet-beta"
    : "devnet";
}

export function useNetwork() {
  const [network, setNetwork] = useState<SolanaNetwork>(getStoredNetwork);

  const toggleNetwork = useCallback(() => {
    const next: SolanaNetwork = network === "devnet" ? "mainnet-beta" : "devnet";
    localStorage.setItem(STORAGE_KEY, next);
    setNetwork(next);
    window.location.reload();
  }, [network]);

  return { network, toggleNetwork };
}
