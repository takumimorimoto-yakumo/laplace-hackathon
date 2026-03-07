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

function getEndpoint(): string {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (rpcUrl) return rpcUrl;

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (network === "mainnet-beta") return clusterApiUrl("mainnet-beta");
  return clusterApiUrl("devnet");
}

const env = (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "devnet" | "mainnet-beta") ?? "devnet";

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
            url: "https://laplace.city",
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
