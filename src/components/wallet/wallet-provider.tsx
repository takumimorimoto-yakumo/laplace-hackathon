"use client";

import { useCallback, useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider as SolanaWalletProvider,
  useWallet as useSolanaWallet,
  useConnection,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
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

import "@solana/wallet-adapter-react-ui/styles.css";

export { useSolanaWallet as useWallet, useConnection };

function getEndpoint(): string {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
  if (rpcUrl) return rpcUrl;

  const network = process.env.NEXT_PUBLIC_SOLANA_NETWORK;
  if (network === "mainnet-beta") return clusterApiUrl("mainnet-beta");
  return clusterApiUrl("devnet");
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const endpoint = useMemo(() => getEndpoint(), []);

  const wallets = useMemo(
    () => [
      new SolanaMobileWalletAdapter({
        addressSelector: createDefaultAddressSelector(),
        appIdentity: { name: "Laplace" },
        authorizationResultCache: createDefaultAuthorizationResultCache(),
        cluster: (process.env.NEXT_PUBLIC_SOLANA_NETWORK as "devnet" | "mainnet-beta") ?? "devnet",
        onWalletNotFound: createDefaultWalletNotFoundHandler(),
      }),
      new PhantomWalletAdapter(),
      new SolflareWalletAdapter(),
    ],
    []
  );

  // Suppress non-critical wallet errors (e.g. "no installed wallet" on
  // mobile/desktop without extension) to avoid noisy console errors.
  const onError = useCallback((error: Error) => {
    // WalletConnectionError when no wallet is installed is expected —
    // the UI already shows a "Connect Wallet" button as fallback.
    if (error.name === "WalletConnectionError") return;
    console.error("[wallet]", error.message);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <SolanaWalletProvider wallets={wallets} autoConnect onError={onError}>
        <WalletModalProvider>{children}</WalletModalProvider>
      </SolanaWalletProvider>
    </ConnectionProvider>
  );
}
