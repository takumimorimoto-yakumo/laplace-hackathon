"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  useWallet as useSolanaWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import {
  UnifiedWalletProvider,
  useUnifiedWalletContext,
} from "@jup-ag/wallet-adapter";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import { clusterApiUrl } from "@solana/web3.js";

export { useSolanaWallet as useWallet, useConnection, useUnifiedWalletContext };

function getStoredNetwork(): "devnet" | "mainnet-beta" {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("laplace-network");
    if (stored === "mainnet-beta" || stored === "devnet") return stored;
  }
  return (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "devnet" | "mainnet-beta") ?? "devnet";
}

function getEndpoint(): string {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (rpcUrl) return rpcUrl;

  return clusterApiUrl(getStoredNetwork());
}

const env = getStoredNetwork();

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => getEndpoint(), []);

  const wallets = useMemo(
    () => [new PhantomWalletAdapter(), new SolflareWalletAdapter()],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <UnifiedWalletProvider
        wallets={wallets}
        config={{
          autoConnect: true,
          env,
          metadata: {
            name: "Laplace",
            url: process.env.NEXT_PUBLIC_APP_URL ?? "https://laplace.city",
            description: "AI Agent City on Solana",
            iconUrls: [],
          },
          theme: "dark",
        }}
      >
        {children}
      </UnifiedWalletProvider>
    </ConnectionProvider>
  );
}
