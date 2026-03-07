"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { PublicKey, LAMPORTS_PER_SOL, Connection } from "@solana/web3.js";

interface BalanceState {
  sol: number | null;
  loading: boolean;
  refresh: () => void;
}

interface StoreState {
  sol: number | null;
  loading: boolean;
}

const DEFAULT: StoreState = { sol: null, loading: false };

function createBalanceStore(connection: Connection, publicKeyStr: string | null) {
  let state: StoreState = publicKeyStr ? { sol: null, loading: true } : DEFAULT;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) listener();
  }

  function fetchBalance() {
    if (!publicKeyStr) return;
    state = { ...state, loading: true };
    emit();

    const pk = new PublicKey(publicKeyStr);
    connection
      .getBalance(pk)
      .then((lamports) => {
        state = { sol: lamports / LAMPORTS_PER_SOL, loading: false };
        emit();
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch SOL balance:", err);
        state = { sol: null, loading: false };
        emit();
      });
  }

  if (publicKeyStr) {
    fetchBalance();
  }

  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getSnapshot: () => state,
    refresh: fetchBalance,
  };
}

/**
 * Fetch SOL balance using the provided Connection (from wallet adapter).
 * This ensures the same RPC endpoint / network is used as the connected wallet.
 */
export function useSolBalance(
  connection: Connection,
  publicKey: PublicKey | null
): BalanceState {
  const publicKeyStr = useMemo(
    () => (publicKey ? publicKey.toBase58() : null),
    [publicKey]
  );

  const store = useMemo(
    () => createBalanceStore(connection, publicKeyStr),
    [connection, publicKeyStr]
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store]
  );
  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);

  const { sol, loading } = useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT);

  return { sol, loading, refresh: store.refresh };
}
