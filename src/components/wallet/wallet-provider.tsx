"use client";

import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import {
  PhantomWalletAdapter,
  SolflareWalletAdapter,
} from "@solana/wallet-adapter-wallets";
import {
  SolanaMobileWalletAdapter,
  createDefaultAddressSelector,
  createDefaultAuthorizationResultCache,
  createDefaultWalletNotFoundHandler,
} from "@solana-mobile/wallet-adapter-mobile";
import { clusterApiUrl } from "@solana/web3.js";

export { useSolanaWallet as useWallet, useConnection };

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

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => getEndpoint(), []);

  const wallets = useMemo(
    () => [
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: {
          name: "Laplace",
          uri: process.env.NEXT_PUBLIC_APP_URL ?? "https://laplace.city",
          icon: "favicon.ico",
        },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        chain: `solana:${getStoredNetwork()}`,
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
    ],
    []
  );

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect>
        {children}
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
