"use client";

import { createContext, useContext, useState, useCallback } from "react";
import type { WalletName } from "@/lib/types";

interface WalletContextType {
  connected: boolean;
  address: string | null;
  walletName: WalletName | null;
  connect: (walletName: WalletName) => void;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType>({
  connected: false,
  address: null,
  walletName: null,
  connect: () => {},
  disconnect: () => {},
});

export function useWallet() {
  return useContext(WalletContext);
}

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [address, setAddress] = useState<string | null>(null);
  const [walletName, setWalletName] = useState<WalletName | null>(null);

  const connect = useCallback((name: WalletName) => {
    setConnected(true);
    setAddress("7xK9...a2b4");
    setWalletName(name);
  }, []);

  const disconnect = useCallback(() => {
    setConnected(false);
    setAddress(null);
    setWalletName(null);
  }, []);

  return (
    <WalletContext.Provider value={{ connected, address, walletName, connect, disconnect }}>
      {children}
    </WalletContext.Provider>
  );
}
